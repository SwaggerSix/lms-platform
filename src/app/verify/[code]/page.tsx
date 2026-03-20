import { createServiceClient } from "@/lib/supabase/service";
import {
  renderCertificateToSVG,
  getPresetTemplate,
  type DesignData,
  type CertificateData,
} from "@/lib/certificates/renderer";
import { Award, CheckCircle2, XCircle, Clock, Download, ExternalLink, Shield } from "lucide-react";

interface VerifyPageProps {
  params: Promise<{ code: string }>;
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { code } = await params;
  const service = createServiceClient();

  // Look up the user certification
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
        description,
        template_id
      )
    `)
    .eq("verification_code", code)
    .single();

  if (error || !userCert) {
    return <InvalidCertificate code={code} />;
  }

  // Fetch learner name
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
  let statusLabel = "Active";
  let statusType: "valid" | "expired" | "revoked" = "valid";

  if (userCert.status === "revoked") {
    valid = false;
    statusLabel = "Revoked";
    statusType = "revoked";
  } else if (valid && userCert.expires_at) {
    const expiry = new Date(userCert.expires_at);
    if (expiry < new Date()) {
      valid = false;
      statusLabel = "Expired";
      statusType = "expired";
    }
  } else if (userCert.status === "expired") {
    valid = false;
    statusLabel = "Expired";
    statusType = "expired";
  }

  // Load design template
  let designData: DesignData = getPresetTemplate("classic");
  if (certification?.template_id) {
    const { data: template } = await service
      .from("certificate_templates")
      .select("design_data")
      .eq("id", certification.template_id)
      .single();
    if (template?.design_data) {
      designData = template.design_data as DesignData;
    }
  } else {
    // Try default template
    const { data: defaultTemplate } = await service
      .from("certificate_templates")
      .select("design_data")
      .eq("is_default", true)
      .eq("status", "active")
      .single();
    if (defaultTemplate?.design_data) {
      designData = defaultTemplate.design_data as DesignData;
    }
  }

  const credentialId = userCert.metadata?.credential_id
    || `CERT-${(certification?.id || userCert.id).slice(0, 8).toUpperCase()}`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lms.example.com";

  const certData: CertificateData = {
    learner_name: learnerName,
    course_name: certification?.name || "Certification",
    completion_date: userCert.issued_at
      ? new Date(userCert.issued_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "",
    score: userCert.metadata?.score ? `${userCert.metadata.score}%` : "",
    certificate_id: code,
    company_name: "LearnHub",
    company_logo: "",
    verification_url: `${baseUrl}/verify/${code}`,
    issue_date: userCert.issued_at
      ? new Date(userCert.issued_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "",
    expiry_date: userCert.expires_at
      ? new Date(userCert.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "No expiration",
    credential_id: credentialId,
  };

  const rawSvg = renderCertificateToSVG(designData, certData);
  // Strip script tags, event handlers, and javascript: URIs from SVG to prevent XSS
  const svgString = rawSvg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\bon\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\bon\w+\s*=\s*'[^']*'/gi, "")
    .replace(/xlink:href\s*=\s*"javascript:[^"]*"/gi, "")
    .replace(/xlink:href\s*=\s*'javascript:[^']*'/gi, "")
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, "")
    .replace(/href\s*=\s*'javascript:[^']*'/gi, "");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-indigo-600" />
            <span className="text-lg font-bold text-gray-900">LearnHub</span>
            <span className="text-sm text-gray-500 ml-2">Certificate Verification</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-500">Verified Document</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Status Banner */}
        <div className={`rounded-xl border-2 p-6 mb-8 ${
          valid
            ? "border-green-200 bg-green-50"
            : statusType === "expired"
            ? "border-yellow-200 bg-yellow-50"
            : "border-red-200 bg-red-50"
        }`}>
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-full ${
              valid ? "bg-green-100" : statusType === "expired" ? "bg-yellow-100" : "bg-red-100"
            }`}>
              {valid ? (
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              ) : statusType === "expired" ? (
                <Clock className="h-7 w-7 text-yellow-600" />
              ) : (
                <XCircle className="h-7 w-7 text-red-600" />
              )}
            </div>
            <div>
              <h2 className={`text-xl font-bold ${
                valid ? "text-green-800" : statusType === "expired" ? "text-yellow-800" : "text-red-800"
              }`}>
                {valid ? "Valid Certificate" : statusType === "expired" ? "Expired Certificate" : "Invalid Certificate"}
              </h2>
              <p className={`text-sm ${
                valid ? "text-green-600" : statusType === "expired" ? "text-yellow-600" : "text-red-600"
              }`}>
                {valid
                  ? "This certificate has been verified and is currently active."
                  : statusType === "expired"
                  ? `This certificate expired on ${certData.expiry_date}.`
                  : "This certificate has been revoked."}
              </p>
            </div>
          </div>
        </div>

        {/* Certificate Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Recipient</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{learnerName}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Certification</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{certification?.name || "Certification"}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Verification Code</p>
            <p className="mt-1 text-lg font-semibold font-mono text-indigo-600">{code}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Issue Date</p>
            <p className="mt-1 font-medium text-gray-900">{certData.issue_date || "N/A"}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Expiry Date</p>
            <p className="mt-1 font-medium text-gray-900">{certData.expiry_date}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Credential ID</p>
            <p className="mt-1 font-medium font-mono text-gray-900">{credentialId}</p>
          </div>
        </div>

        {certification?.description && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-8">
            <p className="text-sm text-gray-500 mb-2">About this Certification</p>
            <p className="text-gray-700">{certification.description}</p>
          </div>
        )}

        {/* Certificate Visual */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Certificate</h3>
            <DownloadButton svgString={svgString} designData={designData} certData={certData} />
          </div>
          <div className="flex justify-center overflow-auto">
            <div
              style={{
                width: designData.dimensions.width * 0.65,
                height: designData.dimensions.height * 0.65,
              }}
              className="shadow-lg rounded overflow-hidden"
            >
              <div
                style={{
                  transform: "scale(0.65)",
                  transformOrigin: "top left",
                  width: designData.dimensions.width,
                  height: designData.dimensions.height,
                }}
                dangerouslySetInnerHTML={{ __html: svgString }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-400 py-8">
          <p>This certificate was issued by LearnHub and can be verified at this URL.</p>
          <p className="mt-1 font-mono text-xs">{baseUrl}/verify/{code}</p>
        </div>
      </main>
    </div>
  );
}

function DownloadButton({
  svgString,
  designData,
  certData,
}: {
  svgString: string;
  designData: DesignData;
  certData: CertificateData;
}) {
  const printHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Certificate</title>
<style>@page{size:${designData.dimensions.orientation};margin:0}*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#fff}
.w{width:${designData.dimensions.width}px;height:${designData.dimensions.height}px}.w svg{width:100%;height:100%}</style>
</head><body><div class="w">${svgString.replace(/"/g, "&quot;")}</div>
<script>window.onload=function(){window.print()}<\/script></body></html>`;

  return (
    <a
      href={`data:text/html;charset=utf-8,${encodeURIComponent(printHtml)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <Download className="h-4 w-4" /> Download PDF
    </a>
  );
}

function InvalidCertificate({ code }: { code: string }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center gap-2">
          <Award className="h-6 w-6 text-indigo-600" />
          <span className="text-lg font-bold text-gray-900">LearnHub</span>
          <span className="text-sm text-gray-500 ml-2">Certificate Verification</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 mb-6">
          <XCircle className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Certificate Not Found</h1>
        <p className="text-gray-500 mb-4">
          No certificate was found with the verification code:
        </p>
        <p className="font-mono text-lg text-gray-700 mb-8 bg-gray-100 inline-block px-4 py-2 rounded-lg">{code}</p>
        <p className="text-sm text-gray-400">
          If you believe this is an error, please contact the issuing organization.
        </p>
      </main>
    </div>
  );
}
