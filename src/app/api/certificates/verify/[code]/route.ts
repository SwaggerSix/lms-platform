import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { generateCertificatePDF } from "@/lib/pdf/generate";

// Public verification endpoint - NO auth required
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: userCert, error } = await service
    .from("user_certifications")
    .select(`
      id,
      issued_at,
      expires_at,
      status,
      verification_code,
      metadata,
      user_id,
      certification:certifications (
        id,
        name,
        description
      )
    `)
    .eq("verification_code", code.trim())
    .single();

  if (error || !userCert) {
    return NextResponse.json(
      { valid: false, error: "Certificate not found" },
      { status: 404 }
    );
  }

  // Fetch the learner name
  const { data: certUser } = await service
    .from("users")
    .select("first_name, last_name")
    .eq("id", userCert.user_id)
    .single();

  const learnerName = certUser
    ? `${certUser.first_name || ""} ${certUser.last_name || ""}`.trim() || "Learner"
    : "Learner";

  const certification = userCert.certification as any;

  // Determine validity
  let valid = userCert.status === "active";
  let statusText = userCert.status;

  if (valid && userCert.expires_at) {
    const now = new Date();
    const expiry = new Date(userCert.expires_at);
    if (expiry < now) {
      valid = false;
      statusText = "expired";
    }
  }

  const credentialId = userCert.metadata?.credential_id
    || `CERT-${(certification?.id || userCert.id).slice(0, 8).toUpperCase()}`;
  const courseName = certification?.name || "Certification";

  // Support ?format=pdf to download the certificate as a PDF
  const format = request.nextUrl.searchParams.get("format");
  if (format === "pdf") {
    if (!valid) {
      return NextResponse.json(
        { error: "Cannot generate PDF for an invalid certificate" },
        { status: 400 }
      );
    }

    const pdfBuffer = await generateCertificatePDF({
      learnerName,
      courseName,
      completionDate: userCert.issued_at
        ? new Date(userCert.issued_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "N/A",
      credentialId,
      certificationName: courseName,
    });

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate_${code}.pdf"`,
      },
    });
  }

  return NextResponse.json({
    valid,
    status: statusText,
    learner_name: learnerName,
    course_name: courseName,
    description: certification?.description || "",
    issue_date: userCert.issued_at || null,
    expiry_date: userCert.expires_at || null,
    credential_id: credentialId,
    verification_code: userCert.verification_code,
  });
}
