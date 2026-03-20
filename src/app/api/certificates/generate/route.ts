import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  renderCertificateToSVG,
  renderCertificateToPDF,
  generateVerificationCode,
  getPresetTemplate,
  type DesignData,
  type CertificateData,
} from "@/lib/certificates/renderer";

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Certificate PDF generation is CPU-intensive — limit to 10 per minute per user
  const rl = await rateLimit(`cert-generate-${auth.user.id}`, 10, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const service = createServiceClient();
  const body = await request.json();

  const { user_certification_id, user_id, certification_id } = body;

  // Find the user_certification record
  let userCertQuery = service
    .from("user_certifications")
    .select(`
      *,
      certification:certifications (
        id, name, description, template_id
      )
    `);

  if (user_certification_id) {
    userCertQuery = userCertQuery.eq("id", user_certification_id);
  } else if (user_id && certification_id) {
    userCertQuery = userCertQuery
      .eq("user_id", user_id)
      .eq("certification_id", certification_id);
  } else {
    return NextResponse.json(
      { error: "Provide user_certification_id or both user_id and certification_id" },
      { status: 400 }
    );
  }

  const { data: userCert, error: ucError } = await userCertQuery.single();

  if (ucError || !userCert) {
    return NextResponse.json({ error: "User certification not found" }, { status: 404 });
  }

  // Check permissions: admins can generate for anyone, others only for themselves
  if (!["admin", "manager"].includes(auth.user.role) && userCert.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch the user's name
  const { data: certUser } = await service
    .from("users")
    .select("first_name, last_name")
    .eq("id", userCert.user_id)
    .single();

  const learnerName = certUser
    ? `${certUser.first_name || ""} ${certUser.last_name || ""}`.trim() || "Learner"
    : "Learner";

  // Determine the template to use
  let designData: DesignData;
  const certification = userCert.certification as any;
  const templateId = certification?.template_id;

  if (templateId) {
    const { data: template } = await service
      .from("certificate_templates")
      .select("design_data")
      .eq("id", templateId)
      .single();

    if (template?.design_data) {
      designData = template.design_data as DesignData;
    } else {
      designData = getPresetTemplate("classic");
    }
  } else {
    // Check for a default template
    const { data: defaultTemplate } = await service
      .from("certificate_templates")
      .select("design_data")
      .eq("is_default", true)
      .eq("status", "active")
      .single();

    if (defaultTemplate?.design_data) {
      designData = defaultTemplate.design_data as DesignData;
    } else {
      designData = getPresetTemplate("classic");
    }
  }

  // Generate or reuse verification code
  let verificationCode = userCert.verification_code;
  if (!verificationCode) {
    verificationCode = generateVerificationCode();
    // Retry if collision (very unlikely)
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await service
        .from("user_certifications")
        .select("id")
        .eq("verification_code", verificationCode)
        .single();

      if (!existing) break;
      verificationCode = generateVerificationCode();
      attempts++;
    }
  }

  // Build the public verification URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(".supabase.co", "") || "https://lms.example.com";
  const publicUrl = `${baseUrl}/verify/${verificationCode}`;

  // Build certificate data
  const credentialId = userCert.metadata?.credential_id
    || `CERT-${(certification?.id || userCert.id).slice(0, 8).toUpperCase()}`;

  const certData: CertificateData = {
    learner_name: learnerName,
    course_name: certification?.name || "Certification",
    completion_date: userCert.issued_at
      ? new Date(userCert.issued_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "",
    score: userCert.metadata?.score ? `${userCert.metadata.score}%` : "",
    certificate_id: verificationCode,
    company_name: "LearnHub",
    company_logo: "",
    verification_url: publicUrl,
    issue_date: userCert.issued_at
      ? new Date(userCert.issued_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "",
    expiry_date: userCert.expires_at
      ? new Date(userCert.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "",
    credential_id: credentialId,
  };

  // Render
  const svgString = renderCertificateToSVG(designData, certData);
  const htmlString = renderCertificateToPDF(designData, certData);

  // Update user_certification with verification code and public URL
  await service
    .from("user_certifications")
    .update({
      verification_code: verificationCode,
      public_url: publicUrl,
    })
    .eq("id", userCert.id);

  return NextResponse.json({
    verification_code: verificationCode,
    public_url: publicUrl,
    svg: svgString,
    html: htmlString,
    certificate_data: certData,
  });
}
