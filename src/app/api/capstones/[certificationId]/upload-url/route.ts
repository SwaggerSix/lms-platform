import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { learnerCapstoneContext } from "@/lib/capstones/context";
import {
  CAPSTONE_BUCKET,
  MAX_CAPSTONE_FILE_BYTES,
  capstoneContentType,
  capstonePrefix,
  safeFileName,
} from "@/lib/capstones/rules";

type Params = { params: Promise<{ certificationId: string }> };

const Body = z.object({
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().positive(),
});

/**
 * POST /api/capstones/[certificationId]/upload-url  { file_name, file_size }
 *
 * A one-time signed upload URL into the private capstones bucket, under the
 * learner's own folder, so the browser sends the file straight to storage
 * (a Vercel function caps request bodies at ~4.5MB). Only while the capstone
 * is open for them. The file only becomes part of a submission when it is
 * named in the submit call, which re-checks the folder.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { certificationId } = await params;
  const ctx = await learnerCapstoneContext(certificationId);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.state.kind !== "open") {
    return NextResponse.json({ error: "Your capstone isn't open for a submission right now." }, { status: 409 });
  }

  const rl = await rateLimit(`capstone-upload-url-${ctx.userId}`, 30, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { file_name, file_size } = parsed.data;

  if (file_size > MAX_CAPSTONE_FILE_BYTES) {
    return NextResponse.json({ error: "That file is over 50 MB. For a recording, submit a link instead." }, { status: 400 });
  }
  const contentType = capstoneContentType(file_name);
  if (!contentType) {
    return NextResponse.json(
      { error: "Upload a PDF, Word, PowerPoint, Excel, PNG or JPEG file. For a recording, submit a link instead." },
      { status: 400 }
    );
  }

  const path = `${capstonePrefix(ctx.userId, ctx.certification.id)}${crypto.randomUUID()}-${safeFileName(file_name)}`;
  const { data, error } = await ctx.service.storage.from(CAPSTONE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[capstones] signed upload URL error:", error?.message);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });
  }
  return NextResponse.json({ path: data.path, token: data.token, signedUrl: data.signedUrl, contentType });
}
