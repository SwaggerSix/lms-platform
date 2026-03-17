"use client";

import { useState, Fragment } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  CalendarPlus,
  Download,
  ChevronDown,
  ChevronRight,
  Bell,
  FileText,
  Loader2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDate, formatPercent } from "@/utils/format";
import { useToast } from "@/components/ui/toast";

export interface MemberCompliance {
  id: string;
  name: string;
  avatar: string;
  status: "completed" | "in-progress" | "overdue" | "not-started";
  completedDate: string | null;
  progress: number;
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  regulation: string;
  regulationColor: string;
  deadline: string;
  completedCount: number;
  totalCount: number;
  members: MemberCompliance[];
}

export interface ExpiringAlert {
  requirement: string;
  daysLeft: number;
  membersRemaining: number;
}

const memberStatusStyles: Record<string, { bg: string; text: string; label: string }> = {
  completed: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
  "in-progress": { bg: "bg-blue-100", text: "text-blue-700", label: "In Progress" },
  overdue: { bg: "bg-red-100", text: "text-red-700", label: "Overdue" },
  "not-started": { bg: "bg-gray-100", text: "text-gray-600", label: "Not Started" },
};

export default function ComplianceClient({
  requirements,
  expiringAlerts,
}: {
  requirements: ComplianceRequirement[];
  expiringAlerts: ExpiringAlert[];
}) {
  const toast = useToast();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [alertReminderLoading, setAlertReminderLoading] = useState<number | null>(null);
  const [sendLoading, setSendLoading] = useState<string | null>(null);
  const [extendLoading, setExtendLoading] = useState<string | null>(null);

  const totalCompleted = requirements.reduce((sum, r) => sum + r.completedCount, 0);
  const totalRequired = requirements.reduce((sum, r) => sum + r.totalCount, 0);
  const overallComplianceRate = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;

  const stats = {
    compliant: requirements.filter((r) => r.completedCount === r.totalCount).length,
    nonCompliant: requirements.filter(
      (r) => r.members.some((m) => m.status === "overdue")
    ).length,
    expiringSoon: expiringAlerts.filter((a) => a.daysLeft <= 30).length,
    overdue: requirements.reduce(
      (sum, r) => sum + r.members.filter((m) => m.status === "overdue").length,
      0
    ),
  };

  // SVG circular progress parameters
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (overallComplianceRate / 100) * circumference;

  const handleAlertRemind = async (alert: ExpiringAlert, index: number) => {
    setAlertReminderLoading(index);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "compliance_reminder",
          message: `Compliance reminder: "${alert.requirement}" expires in ${alert.daysLeft} days. ${alert.membersRemaining} member(s) still need to complete this requirement.`,
          requirement: alert.requirement,
          days_left: alert.daysLeft,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send reminder");
      }
      toast.success(`Compliance reminder sent for "${alert.requirement}".`);
    } catch (error) {
      console.error("Send compliance reminder failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send reminder"
      );
    } finally {
      setAlertReminderLoading(null);
    }
  };

  const handleSendReminder = async (req: ComplianceRequirement) => {
    setSendLoading(req.id);
    try {
      const incompleteMembers = req.members.filter(
        (m) => m.status !== "completed"
      );
      await Promise.all(
        incompleteMembers.map((member) =>
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: member.id,
              user_name: member.name,
              type: "compliance_reminder",
              message: `Reminder: "${req.name}" is due by ${formatDate(req.deadline)}. Please complete this requirement.`,
              requirement_id: req.id,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || "Failed to send reminder");
            }
            return res.json();
          })
        )
      );
      toast.success(
        `Reminder sent to ${incompleteMembers.length} member(s) for "${req.name}".`
      );
    } catch (error) {
      console.error("Send reminder failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send reminders"
      );
    } finally {
      setSendLoading(null);
    }
  };

  const handleExtendDeadline = async (req: ComplianceRequirement) => {
    const newDate = prompt("Enter new deadline (YYYY-MM-DD):");
    if (!newDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      toast.warning("Invalid date format. Please use YYYY-MM-DD.");
      return;
    }
    setExtendLoading(req.id);
    try {
      const incompleteMembers = req.members.filter(
        (m) => m.status !== "completed"
      );
      await Promise.all(
        incompleteMembers.map((member) =>
          fetch("/api/enrollments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enrollment_id: member.id,
              requirement_id: req.id,
              due_date: newDate,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || "Failed to extend deadline");
            }
            return res.json();
          })
        )
      );
      toast.success(
        `Deadline for "${req.name}" extended to ${newDate} for ${incompleteMembers.length} member(s).`
      );
    } catch (error) {
      console.error("Extend deadline failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to extend deadline"
      );
    } finally {
      setExtendLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="h-8 w-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Team Compliance
            </h1>
          </div>
          <p className="text-gray-500 mt-1">
            Track compliance requirements and team completion status
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
          <Download className="h-4 w-4" />
          Export Compliance Report
        </button>
      </div>

      {/* Overall Compliance + Stats */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Large Circular Progress */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-1">
          <div className="relative mb-3">
            <svg width="160" height="160" className="-rotate-90">
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="12"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={overallComplianceRate >= 80 ? "#22c55e" : overallComplianceRate >= 60 ? "#f59e0b" : "#ef4444"}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">
                {overallComplianceRate}%
              </span>
              <span className="text-xs text-gray-500">Overall</span>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-700">
            Compliance Rate
          </p>
          <p className="text-xs text-gray-400">
            {totalCompleted}/{totalRequired} completed
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-4">
          {[
            {
              label: "Compliant",
              value: stats.compliant,
              subtitle: "requirements fully met",
              icon: CheckCircle2,
              color: "text-green-600",
              bg: "bg-green-50",
              border: "border-green-200",
            },
            {
              label: "Non-Compliant",
              value: stats.nonCompliant,
              subtitle: "requirements with overdue",
              icon: XCircle,
              color: "text-red-600",
              bg: "bg-red-50",
              border: "border-red-200",
            },
            {
              label: "Expiring Soon",
              value: stats.expiringSoon,
              subtitle: "deadlines within 30 days",
              icon: Clock,
              color: "text-amber-600",
              bg: "bg-amber-50",
              border: "border-amber-200",
            },
            {
              label: "Overdue Items",
              value: stats.overdue,
              subtitle: "individual items overdue",
              icon: AlertTriangle,
              color: "text-red-600",
              bg: "bg-red-50",
              border: "border-red-200",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "rounded-xl border bg-white p-5 shadow-sm",
                stat.border
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {stat.subtitle}
                  </p>
                </div>
                <div className={cn("rounded-lg p-3", stat.bg)}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Section */}
      {expiringAlerts.length > 0 && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">
              Upcoming Expirations
            </h3>
          </div>
          <div className="space-y-2">
            {expiringAlerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-white/70 px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={cn(
                      "h-4 w-4",
                      alert.daysLeft <= 10
                        ? "text-red-500"
                        : "text-amber-500"
                    )}
                  />
                  <span className="text-sm font-medium text-gray-800">
                    {alert.requirement}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      alert.daysLeft <= 10
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {alert.daysLeft} days left
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {alert.membersRemaining} member(s) remaining
                  </span>
                  <button
                    onClick={() => handleAlertRemind(alert, i)}
                    disabled={alertReminderLoading === i}
                    className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                  >
                    {alertReminderLoading === i ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Sending...
                      </span>
                    ) : (
                      <>
                        <Send className="mr-1 inline h-3 w-3" />
                        Remind
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Requirements Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Requirement
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Regulation
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Deadline
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Team Progress
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requirements.map((req) => {
                const completionRate = req.totalCount > 0 ? Math.round(
                  (req.completedCount / req.totalCount) * 100
                ) : 0;
                const isExpanded = expandedRow === req.id;
                const daysUntilDeadline = Math.ceil(
                  (new Date(req.deadline).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24)
                );

                return (
                  <Fragment key={req.id}>
                    <tr
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() =>
                        setExpandedRow(isExpanded ? null : req.id)
                      }
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="font-medium text-gray-900">
                            {req.name}
                          </span>
                          {completionRate === 100 && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            req.regulationColor
                          )}
                        >
                          {req.regulation}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm",
                              daysUntilDeadline <= 14
                                ? "font-semibold text-red-600"
                                : "text-gray-600"
                            )}
                          >
                            {formatDate(req.deadline)}
                          </span>
                          {daysUntilDeadline <= 14 && daysUntilDeadline > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                              {daysUntilDeadline}d left
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2.5 w-32 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                completionRate === 100
                                  ? "bg-green-500"
                                  : completionRate >= 75
                                  ? "bg-blue-500"
                                  : completionRate >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              )}
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {req.completedCount}/{req.totalCount}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            title="Send Reminder"
                            onClick={() => handleSendReminder(req)}
                            disabled={sendLoading === req.id}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                          >
                            {sendLoading === req.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            title="Extend Deadline"
                            onClick={() => handleExtendDeadline(req)}
                            disabled={extendLoading === req.id}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                          >
                            {extendLoading === req.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CalendarPlus className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Row - Individual Member Status */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50/50 px-6 py-4">
                          <div className="ml-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {req.members.map((member) => {
                              const style = memberStatusStyles[member.status];
                              return (
                                <div
                                  key={member.id}
                                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5"
                                >
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                                    {member.avatar}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {member.name}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={cn(
                                          "rounded-full px-2 py-0.5 text-xs font-medium",
                                          style.bg,
                                          style.text
                                        )}
                                      >
                                        {style.label}
                                      </span>
                                      {member.status === "in-progress" && (
                                        <span className="text-xs text-gray-400">
                                          {formatPercent(member.progress)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
