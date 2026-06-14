import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ErrorLogClient, { type ErrorLogEntry } from "./error-log-client";

export const metadata: Metadata = {
  title: "Error Log | LMS Platform",
  description: "Review and resolve platform errors",
};

export default async function ErrorLogPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  if (dbUser.role !== "admin" && dbUser.role !== "super_admin") {
    redirect("/dashboard");
  }

  const { data: rows } = await service
    .from("error_logs")
    .select("*, resolver:users!resolved_by(id, first_name, last_name, email)")
    .order("created_at", { ascending: false })
    .limit(500);

  const entries: ErrorLogEntry[] = (rows ?? []).map((row: any) => {
    const resolver = row.resolver as any;
    const resolverName = resolver
      ? `${resolver.first_name ?? ""} ${resolver.last_name ?? ""}`.trim() ||
        resolver.email ||
        "Unknown"
      : null;
    return {
      id: row.id,
      createdAt: row.created_at,
      source: row.source,
      severity: row.severity,
      message: row.message,
      stack: row.stack ?? null,
      path: row.path ?? null,
      method: row.method ?? null,
      statusCode: row.status_code ?? null,
      digest: row.digest ?? null,
      context: row.context ?? null,
      resolved: !!row.resolved,
      resolvedAt: row.resolved_at ?? null,
      resolverName,
      resolutionNotes: row.resolution_notes ?? null,
    };
  });

  return <ErrorLogClient initialEntries={entries} />;
}
