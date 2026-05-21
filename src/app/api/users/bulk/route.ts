import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { sendEmail, welcomeWithTemporaryPassword } from "@/lib/email";

function generateTemporaryPassword(): string {
  return crypto.randomBytes(16).toString("base64url");
}

function getLoginUrl(request: NextRequest): string {
  // Prefer configured public URL; fall back to the request origin.
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return `${envUrl.replace(/\/$/, "")}/login`;
  const origin = request.headers.get("origin") || request.nextUrl.origin;
  return `${origin.replace(/\/$/, "")}/login`;
}

const VALID_ROLES = ["admin", "manager", "instructor", "learner"] as const;
type Role = (typeof VALID_ROLES)[number];

interface InputRow {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  organization_id?: string;
  job_title?: string;
}

interface ResultRow {
  rowIndex: number;
  email: string;
  status: "created" | "skipped" | "failed" | "enrollment_partial";
  userId?: string;
  temporaryPassword?: string;
  welcomeEmailSent?: boolean;
  welcomeEmailError?: string;
  message?: string;
  enrolledCourseCount?: number;
  enrollmentErrors?: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: {
    users?: InputRow[];
    enroll_in_course_ids?: string[];
    send_welcome_email?: boolean;
    include_passwords_in_response?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rows = Array.isArray(body.users) ? body.users : [];
  const courseIds = Array.isArray(body.enroll_in_course_ids) ? body.enroll_in_course_ids.filter((id): id is string => typeof id === "string") : [];
  // Default ON: deliver temporary credentials via email rather than dumping into the API response.
  const sendWelcomeEmail = body.send_welcome_email !== false;
  // Default OFF: omit temporary passwords from the API response/CSV unless the admin explicitly opts in
  // (e.g. when no email is configured and they need an out-of-band distribution).
  const includePasswordsInResponse = body.include_passwords_in_response === true;
  const loginUrl = getLoginUrl(request);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No user rows supplied" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: "Maximum 500 users per import" }, { status: 400 });
  }

  const service = createServiceClient();
  const results: ResultRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 1;
    const email = (row.email ?? "").trim().toLowerCase();
    const firstName = (row.first_name ?? "").trim();
    const lastName = (row.last_name ?? "").trim();
    const roleInput = (row.role ?? "learner").trim().toLowerCase();
    const role: Role = (VALID_ROLES as readonly string[]).includes(roleInput) ? (roleInput as Role) : "learner";

    if (!email || !EMAIL_RE.test(email)) {
      results.push({ rowIndex, email, status: "failed", message: "Invalid or missing email" });
      continue;
    }
    if (!firstName || !lastName) {
      results.push({ rowIndex, email, status: "failed", message: "First name and last name are required" });
      continue;
    }

    // Check for existing user by email
    const { data: existing } = await service
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      // Still try to enroll the existing user if course IDs were provided
      let enrolledCount = 0;
      const enrollmentErrors: string[] = [];
      if (courseIds.length > 0) {
        const result = await enrollUserInCourses(service, existing.id, courseIds, auth.user.id);
        enrolledCount = result.enrolled;
        enrollmentErrors.push(...result.errors);
      }
      results.push({
        rowIndex,
        email,
        status: "skipped",
        message: "User already exists",
        userId: existing.id,
        enrolledCourseCount: enrolledCount,
        enrollmentErrors: enrollmentErrors.length > 0 ? enrollmentErrors : undefined,
      });
      continue;
    }

    // Create auth user
    const temporaryPassword = generateTemporaryPassword();
    const { data: authCreated, error: authErr } = await service.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (authErr || !authCreated?.user) {
      const msg = authErr?.message || "Failed to create auth account";
      results.push({ rowIndex, email, status: "failed", message: msg });
      continue;
    }

    const payload: Record<string, unknown> = {
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      auth_id: authCreated.user.id,
      preferences: { must_change_password: true },
    };
    if (row.organization_id) payload.organization_id = row.organization_id;
    if (row.job_title) payload.job_title = row.job_title;

    const { data: dbUser, error: dbErr } = await service
      .from("users")
      .insert(payload)
      .select("id, email")
      .single();

    if (dbErr || !dbUser) {
      await service.auth.admin.deleteUser(authCreated.user.id).catch(() => {});
      results.push({ rowIndex, email, status: "failed", message: dbErr?.message || "Failed to insert user" });
      continue;
    }

    let enrolledCount = 0;
    const enrollmentErrors: string[] = [];
    if (courseIds.length > 0) {
      const result = await enrollUserInCourses(service, dbUser.id, courseIds, auth.user.id);
      enrolledCount = result.enrolled;
      enrollmentErrors.push(...result.errors);
    }

    let welcomeEmailSent: boolean | undefined;
    let welcomeEmailError: string | undefined;
    if (sendWelcomeEmail) {
      try {
        const template = welcomeWithTemporaryPassword({
          learnerName: firstName,
          email,
          temporaryPassword,
          loginUrl,
        });
        const sendResult = await sendEmail({
          to: email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
        welcomeEmailSent = sendResult.success;
        if (!sendResult.success) {
          welcomeEmailError = sendResult.error;
        }
      } catch (err: unknown) {
        welcomeEmailSent = false;
        welcomeEmailError = err instanceof Error ? err.message : "Failed to send welcome email";
      }
    }

    logAudit({
      userId: auth.user.id,
      action: "created",
      entityType: "user",
      entityId: dbUser.id,
      newValues: { email: dbUser.email, role, via: "bulk_import" },
    });

    results.push({
      rowIndex,
      email,
      userId: dbUser.id,
      status: enrollmentErrors.length > 0 ? "enrollment_partial" : "created",
      temporaryPassword: includePasswordsInResponse ? temporaryPassword : undefined,
      welcomeEmailSent,
      welcomeEmailError,
      enrolledCourseCount: enrolledCount,
      enrollmentErrors: enrollmentErrors.length > 0 ? enrollmentErrors : undefined,
    });
  }

  const created = results.filter((r) => r.status === "created" || r.status === "enrollment_partial").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    summary: { total: rows.length, created, skipped, failed },
    results,
  });
}

async function enrollUserInCourses(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  courseIds: string[],
  assignedBy: string
): Promise<{ enrolled: number; errors: string[] }> {
  let enrolled = 0;
  const errors: string[] = [];
  for (const courseId of courseIds) {
    // Check if already enrolled
    const { data: existing } = await service
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existing) {
      enrolled++;
      continue;
    }
    const { error } = await service.from("enrollments").insert({
      user_id: userId,
      course_id: courseId,
      status: "enrolled",
      assigned_by: assignedBy,
    });
    if (error) {
      errors.push(`Course ${courseId}: ${error.message}`);
    } else {
      enrolled++;
    }
  }
  return { enrolled, errors };
}
