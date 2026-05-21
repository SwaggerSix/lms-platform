"use client";

import Link from "next/link";
import { Users, AlertTriangle, Clock, Award, ShieldCheck, ArrowRight } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ManagerDashboardData {
  managerName: string;
  teamSize: number;
  overdueCount: number;
  dueThisWeekCount: number;
  verifiedCpeLastYear: number;
  requiredComplianceRate: number;
  overdue: {
    enrollmentId: string;
    learnerId: string;
    learnerName: string;
    courseTitle: string;
    daysOverdue: number;
  }[];
  dueThisWeek: {
    enrollmentId: string;
    learnerId: string;
    learnerName: string;
    courseTitle: string;
    daysUntilDue: number;
  }[];
  requiredCompliance: {
    learnerId: string;
    learnerName: string;
    required: number;
    complete: number;
    percent: number;
    verifiedCpe: number;
  }[];
  /** Recurring-compliance completions that have expired or will expire ≤30 days. Display list — truncated. */
  recertificationsDue: {
    learnerId: string;
    learnerName: string;
    courseTitle: string;
    regulation: string | null;
    /** Negative = overdue. */
    daysUntilExpiry: number;
  }[];
  /** Total count across all reports (un-truncated). Use this for dashboard tiles. */
  recertificationsDueCount: number;
  recentCompletions: {
    enrollmentId: string;
    learnerName: string;
    courseTitle: string;
    completedAt: string;
  }[];
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ManagerDashboardClient({ data }: { data: ManagerDashboardData }) {
  const recertCount = data.recertificationsDueCount;
  const stats: {
    label: string;
    value: string;
    icon: typeof Users;
    tone: string;
    href?: string;
  }[] = [
    {
      label: "Direct Reports",
      value: data.teamSize.toLocaleString(),
      icon: Users,
      tone: "text-indigo-600 bg-indigo-50",
      href: "/manager/team",
    },
    {
      label: "Overdue Training",
      value: data.overdueCount.toLocaleString(),
      icon: AlertTriangle,
      tone: "text-red-600 bg-red-50",
      href: "/manager/compliance",
    },
    {
      label: "Due This Week",
      value: data.dueThisWeekCount.toLocaleString(),
      icon: Clock,
      tone: "text-amber-600 bg-amber-50",
      href: "/manager/compliance",
    },
    {
      label: "Recertifications ≤30d",
      value: recertCount.toLocaleString(),
      icon: ShieldCheck,
      tone: recertCount === 0 ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50",
      href: "/manager/compliance",
    },
    {
      label: "Verified CPE (12 mo)",
      value: data.verifiedCpeLastYear.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      icon: Award,
      tone: "text-emerald-600 bg-emerald-50",
      href: "/manager/reports",
    },
    {
      label: "Required Compliance",
      value: `${data.requiredComplianceRate}%`,
      icon: ShieldCheck,
      tone: data.requiredComplianceRate >= 90 ? "text-emerald-600 bg-emerald-50" : data.requiredComplianceRate >= 70 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50",
      href: "/manager/compliance",
    },
  ];

  if (data.teamSize === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <Users className="mx-auto h-10 w-10 text-gray-300" />
        <h1 className="mt-4 text-xl font-bold text-gray-900">No direct reports yet</h1>
        <p className="mt-1 text-sm text-gray-500">
          When users have their <code className="rounded bg-gray-100 px-1.5 py-0.5">manager_id</code> set to you,
          they&apos;ll appear here with their progress, overdue training, and CPE.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {data.managerName}. Here&apos;s where your team stands today.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => {
          const Icon = s.icon;
          const body = (
            <>
              <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg", s.tone)}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </>
          );
          const className = cn(
            "block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow",
            s.href && "hover:shadow-md cursor-pointer"
          );
          if (s.href) {
            return (
              <Link key={s.label} href={s.href} className={className}>
                {body}
              </Link>
            );
          }
          return (
            <div key={s.label} className={className}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Overdue training */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Overdue Training</h2>
            <Link href="/manager/team" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Team view →
            </Link>
          </div>
          {data.overdue.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">No one&apos;s overdue. Nice work.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.overdue.map((row) => (
                <li key={row.enrollmentId} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{row.learnerName}</p>
                    <p className="text-xs text-gray-500 truncate">{row.courseTitle}</p>
                  </div>
                  <span className="ml-3 shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {row.daysOverdue}d overdue
                  </span>
                </li>
              ))}
              {data.overdueCount > data.overdue.length && (
                <li className="px-5 py-2 text-xs text-gray-500">+ {data.overdueCount - data.overdue.length} more</li>
              )}
            </ul>
          )}
        </div>

        {/* Due this week */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Due This Week</h2>
          </div>
          {data.dueThisWeek.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Nothing due in the next 7 days.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.dueThisWeek.map((row) => (
                <li key={row.enrollmentId} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{row.learnerName}</p>
                    <p className="text-xs text-gray-500 truncate">{row.courseTitle}</p>
                  </div>
                  <span className="ml-3 shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {row.daysUntilDue}d left
                  </span>
                </li>
              ))}
              {data.dueThisWeekCount > data.dueThisWeek.length && (
                <li className="px-5 py-2 text-xs text-gray-500">+ {data.dueThisWeekCount - data.dueThisWeek.length} more</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Required compliance */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Required-Training Compliance</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Required courses per learner come from each course&apos;s required_for criteria
              matching the learner&apos;s role/organization.
            </p>
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-5 py-3">Learner</th>
              <th className="px-5 py-3 text-right">Required</th>
              <th className="px-5 py-3 text-right">Complete</th>
              <th className="px-5 py-3">Progress</th>
              <th className="px-5 py-3 text-right">CPE (12 mo)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.requiredCompliance.map((row) => (
              <tr key={row.learnerId}>
                <td className="px-5 py-3 font-medium text-gray-900">{row.learnerName}</td>
                <td className="px-5 py-3 text-right text-gray-700">{row.required}</td>
                <td className="px-5 py-3 text-right text-gray-700">{row.complete}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-32 rounded-full bg-gray-100">
                      <div
                        className={cn(
                          "h-1.5 rounded-full",
                          row.percent >= 90 ? "bg-emerald-500" : row.percent >= 70 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-10 text-right">{row.percent}%</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right text-emerald-700 font-medium">
                  {row.verifiedCpe.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recertifications due */}
      {data.recertificationsDue.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm">
          <div className="flex items-center justify-between border-b border-amber-200/60 px-5 py-3">
            <h2 className="text-sm font-semibold text-amber-900">
              Recertifications Expiring Soon
              <span className="ml-2 rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                {data.recertificationsDueCount}
              </span>
            </h2>
            <Link
              href="/manager/compliance"
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900"
            >
              Full compliance view
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y divide-amber-100">
            {data.recertificationsDue.map((row) => {
              const overdue = row.daysUntilExpiry < 0;
              return (
                <li key={`${row.learnerId}-${row.courseTitle}`} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{row.learnerName}</p>
                    <p className="truncate text-xs text-gray-600">
                      {row.courseTitle}
                      {row.regulation && (
                        <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                          {row.regulation}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={
                      overdue
                        ? "rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                        : "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                    }
                  >
                    {overdue
                      ? `${Math.abs(row.daysUntilExpiry)}d overdue`
                      : `${row.daysUntilExpiry}d left`}
                  </span>
                </li>
              );
            })}
          </ul>
          {data.recertificationsDueCount > data.recertificationsDue.length && (
            <div className="border-t border-amber-100 px-5 py-2 text-center">
              <Link
                href="/manager/compliance"
                className="text-xs font-medium text-amber-800 hover:text-amber-900"
              >
                Showing {data.recertificationsDue.length} of {data.recertificationsDueCount} —
                view all in compliance
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Recent completions */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Recent Completions</h2>
          <Link href="/manager/reports" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            All reports
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {data.recentCompletions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">No completions yet from your team.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.recentCompletions.map((row) => (
              <li key={row.enrollmentId} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{row.learnerName}</p>
                  <p className="text-xs text-gray-500 truncate">{row.courseTitle}</p>
                </div>
                <span className="ml-3 shrink-0 text-xs text-gray-500">{formatDate(row.completedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
