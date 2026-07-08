import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CertificationsClient from "./certifications-client";
import type { Certificate } from "./certifications-client";
import { deriveStatus } from "@/lib/certifications/status";

export const metadata: Metadata = {
  title: "Certifications | LMS Platform",
  description: "View and manage your earned certifications and credentials",
};

export default async function CertificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch user profile for name
  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id, first_name, last_name")
    .eq("auth_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const userName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Learner";

  // Query user_certifications joined with certifications and the recertification course
  const { data: rows } = await service
    .from("user_certifications")
    .select(
      `
      id,
      issued_at,
      expires_at,
      status,
      certificate_url,
      metadata,
      certification:certifications (
        id,
        name,
        description,
        recertification_course_id,
        recertification_course:courses!certifications_recertification_course_id_fkey ( title )
      )
    `
    )
    .eq("user_id", profile.id)
    .order("issued_at", { ascending: false })
    .limit(100);

  const certificates: Certificate[] = (rows ?? []).map((row: any) => {
    const cert = row.certification;
    const issuedAt = row.issued_at ?? "";
    const expiresAt = row.expires_at ?? "";
    const credentialId =
      row.metadata?.credential_id ??
      `CERT-${(cert?.id ?? row.id).slice(0, 8).toUpperCase()}`;

    return {
      id: row.id,
      name: cert?.name ?? "Certification",
      issuingCourse: cert?.recertification_course?.title ?? cert?.name ?? "—",
      courseId: cert?.recertification_course_id ?? null,
      issueDate: issuedAt,
      expiryDate: expiresAt,
      status: deriveStatus(row.status, row.expires_at),
      credentialId,
      verificationCode: row.verification_code ?? null,
    };
  });

  return <CertificationsClient certificates={certificates} userName={userName} />;
}
