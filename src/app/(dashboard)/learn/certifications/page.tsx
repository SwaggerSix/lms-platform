import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificationsClient from "./certifications-client";
import type { Certificate, CertStatus } from "./certifications-client";

export const metadata: Metadata = {
  title: "Certifications | LMS Platform",
  description: "View and manage your earned certifications and credentials",
};

/** Expiry within 90 days is considered "expiring soon". */
const EXPIRING_SOON_DAYS = 90;

function deriveStatus(dbStatus: string, expiresAt: string | null): CertStatus {
  if (dbStatus === "expired" || dbStatus === "revoked") return "expired";
  if (dbStatus === "active" && expiresAt) {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry <= 0) return "expired";
    if (daysUntilExpiry <= EXPIRING_SOON_DAYS) return "expiring_soon";
  }
  return "active";
}

export default async function CertificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch user profile for name
  const { data: profile } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq("auth_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const userName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Learner";

  // Query user_certifications joined with certifications and the recertification course
  const { data: rows } = await supabase
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
    };
  });

  return <CertificationsClient certificates={certificates} userName={userName} />;
}
