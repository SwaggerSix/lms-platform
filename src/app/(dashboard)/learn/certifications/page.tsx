import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CertificationsClient from "./certifications-client";
import type { Certificate } from "./certifications-client";
import { deriveStatus } from "@/lib/certifications/status";
import { capstoneFor } from "@/lib/certifications/capstone";
import { CERTIFICATE_COMPANY_NAME } from "@/lib/branding";

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
      verification_code,
      metadata,
      certification:certifications (
        id,
        name,
        description,
        recertification_course_id,
        course_id,
        capstone_key,
        completion_course:courses!certifications_course_id_fkey ( title ),
        recertification_course:courses!certifications_recertification_course_id_fkey ( title )
      )
    `
    )
    .eq("user_id", profile.id)
    .neq("status", "revoked")
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
      issuingCourse:
        cert?.completion_course?.title ?? cert?.recertification_course?.title ?? cert?.name ?? "—",
      courseId: cert?.recertification_course_id ?? null,
      issueDate: issuedAt,
      expiryDate: expiresAt,
      status: deriveStatus(row.status, row.expires_at),
      credentialId,
      verificationCode: row.verification_code ?? null,
      issuer: cert?.capstone_key ? "gothamCulture" : CERTIFICATE_COMPANY_NAME,
      awarded: !cert?.course_id && !!cert?.capstone_key,
    };
  });

  // Credentials with a capstone hand-in (Mosaic Certified) the learner is
  // working towards: enrolled in the required course, not certified yet.
  const { data: capstoneCerts } = await service
    .from("certifications")
    .select("id, name, award_requires_course_id, capstone_key")
    .not("capstone_key", "is", null)
    .is("course_id", null)
    .eq("status", "active")
    .limit(20);
  const heldIds = new Set(
    (rows ?? []).filter((r: any) => r.status === "active").map((r: any) => r.certification?.id)
  );
  const requiredCourseIds = (capstoneCerts ?? [])
    .map((c: any) => c.award_requires_course_id)
    .filter(Boolean);
  const { data: myEnrollments } = requiredCourseIds.length
    ? await service.from("enrollments").select("course_id").eq("user_id", profile.id).in("course_id", requiredCourseIds)
    : { data: [] as { course_id: string }[] };
  const enrolledIn = new Set((myEnrollments ?? []).map((e: any) => e.course_id));
  const capstones = (capstoneCerts ?? [])
    .filter((c: any) => !heldIds.has(c.id) && (!c.award_requires_course_id || enrolledIn.has(c.award_requires_course_id)))
    .map((c: any) => ({ id: c.id as string, name: c.name as string, summary: capstoneFor(c.capstone_key)?.summary ?? null }));

  return <CertificationsClient certificates={certificates} userName={userName} capstones={capstones} />;
}
