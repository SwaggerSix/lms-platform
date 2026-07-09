import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ArrowRight, GraduationCap, Users, ClipboardCheck, Shield, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { helpManuals } from "@/content/help";
import type { HelpRole } from "@/content/help/types";

export const metadata: Metadata = {
  title: "Help & Manuals | LMS Platform",
  description: "Role-specific user manuals and FAQs",
};

const ROLE_ICON: Record<HelpRole, React.ComponentType<{ className?: string }>> = {
  learner: GraduationCap,
  manager: Users,
  instructor: ClipboardCheck,
  admin: Shield,
  "super-admin": Globe,
};

const ROLE_BLURB: Record<HelpRole, string> = {
  learner: "How to find courses, complete training, track certifications, and manage your profile.",
  manager: "How to oversee your team, assign training, review approvals, and track compliance.",
  instructor: "How to author content, run instructor-led sessions, grade work, and observe learners.",
  admin: "How to configure the platform, manage users and content, and build automations.",
  "super-admin": "Multi-tenant administration, SSO, audit log, and platform-wide settings.",
};

function mapDbRoleToHelpRole(dbRole: string): HelpRole {
  if (dbRole === "super_admin") return "super-admin";
  if (dbRole === "admin") return "admin";
  if (dbRole === "manager") return "manager";
  if (dbRole === "instructor") return "instructor";
  return "learner";
}

export default async function HelpLandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  const myRole: HelpRole = dbUser ? mapDbRoleToHelpRole(dbUser.role) : "learner";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Help & User Manuals</h1>
        <p className="mt-2 text-base text-gray-600">
          Detailed, role-specific guides for every feature in the platform. Pick the manual that matches your role,
          or use the search button in the top bar to find an answer fast.
        </p>
      </header>

      {/* Suggested manual based on role */}
      <div className="mb-8 rounded-xl border border-primary-200 bg-primary-50 p-6">
        <div className="text-xs font-medium uppercase tracking-wider text-primary-600">Recommended for you</div>
        <h2 className="mt-1 text-xl font-bold text-gray-900">
          {helpManuals.find((m) => m.role === myRole)?.title ?? "Learner Manual"}
        </h2>
        <p className="mt-1 text-sm text-gray-700">{ROLE_BLURB[myRole]}</p>
        <Link
          href={`/help/${myRole}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Open {helpManuals.find((m) => m.role === myRole)?.title ?? "Learner Manual"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* All manuals */}
      <h2 className="mb-4 text-lg font-semibold text-gray-900">All manuals</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {helpManuals.map((m) => {
          const Icon = ROLE_ICON[m.role];
          return (
            <Link
              key={m.role}
              href={`/help/${m.role}`}
              className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="rounded-lg bg-primary-100 p-2.5 text-primary-700">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{m.title}</h3>
                  {m.role === myRole && (
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium uppercase text-primary-700">
                      Yours
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-600">{ROLE_BLURB[m.role]}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary-600 group-hover:underline">
                  <BookOpen className="h-3.5 w-3.5" />
                  {m.groups.reduce((n, g) => n + g.chapters.length, 0)} chapters
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
