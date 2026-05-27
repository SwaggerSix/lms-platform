import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

// POST: upload a nudge action image to the public 'nudge-images' bucket.
export async function POST(request: NextRequest) {
  const auth = await authorize("manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image exceeds 5MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "png";
  const path = `${auth.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const service = createServiceClient();
  const { error } = await service.storage
    .from("nudge-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error("Nudge image upload error:", error.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data } = service.storage.from("nudge-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path }, { status: 201 });
}
