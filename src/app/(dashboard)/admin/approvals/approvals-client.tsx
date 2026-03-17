"use client";

import { useState, useMemo } from "react";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ArrowUpDown,
  X,
  AlertTriangle,
  Timer,
  ThumbsUp,
  ThumbsDown,
  Building2,
  Filter,
  Users,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";
import { useToast } from "@/components/ui/toast";
import type { ApprovalStatus } from "@/types/database";

export interface ApprovalRequest {
  id: string;
  learnerName: string;
  learnerInitials: string;
  learnerEmail: string;
  department: string;
  managerName: string;
  courseTitle: string;
  courseCategory: string;
  requestDate: string;
  decidedAt: string | null;
  status: ApprovalStatus;
  reason: string;
  rejectionReason: string | null;
}

interface ApprovalsClientProps {
  approvals: ApprovalRequest[];
}

type TabFilter = "pending" | "approved" | "rejected" | "all";
type SortField = "date" | "name";
type SortDirection = "asc" | "desc";

const statusConfig: Record<ApprovalStatus, { label: string; bg: string; text: string; icon: typeof Clock }> = {
  pending: { label: "Pending", bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
  approved: { label: "Approved", bg: "bg-green-100", text: "text-green-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", bg: "bg-red-100", text: "text-red-700", icon: XCircle },
  cancelled: { label: "Cancelled", bg: "bg-gray-100", text: "text-gray-700", icon: XCircle },
};

export default function ApprovalsClient({ approvals: initialApprovals }: ApprovalsClientProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabFilter>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(initialApprovals);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const departments = useMemo(
    () => Array.from(new Set(approvals.map((a) => a.department))).sort(),
    [approvals]
  );
  const managers = useMemo(
    () => Array.from(new Set(approvals.map((a) => a.managerName))).sort(),
    [approvals]
  );

  const stats = useMemo(() => {
    const pending = approvals.filter((a) => a.status === "pending").length;
    const approvedThisMonth = approvals.filter(
      (a) =>
        a.status === "approved" &&
        a.decidedAt &&
        new Date(a.decidedAt).getMonth() === new Date().getMonth() &&
        new Date(a.decidedAt).getFullYear() === new Date().getFullYear()
    ).length;
    const rejectedThisMonth = approvals.filter(
      (a) =>
        a.status === "rejected" &&
        a.decidedAt &&
        new Date(a.decidedAt).getMonth() === new Date().getMonth() &&
        new Date(a.decidedAt).getFullYear() === new Date().getFullYear()
    ).length;
    const decidedApprovals = approvals.filter((a) => a.decidedAt);
    const avgResponseHours =
      decidedApprovals.length > 0
        ? Math.round(
            decidedApprovals.reduce((sum, a) => {
              const requested = new Date(a.requestDate).getTime();
              const decided = new Date(a.decidedAt!).getTime();
              return sum + (decided - requested) / (1000 * 60 * 60);
            }, 0) / decidedApprovals.length
          )
        : 0;

    return { pending, approvedThisMonth, rejectedThisMonth, avgResponseHours };
  }, [approvals]);

  const filteredApprovals = useMemo(() => {
    let result = approvals;

    if (activeTab !== "all") {
      result = result.filter((a) => a.status === activeTab);
    }

    if (departmentFilter !== "all") {
      result = result.filter((a) => a.department === departmentFilter);
    }

    if (managerFilter !== "all") {
      result = result.filter((a) => a.managerName === managerFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.learnerName.toLowerCase().includes(q) ||
          a.courseTitle.toLowerCase().includes(q) ||
          a.courseCategory.toLowerCase().includes(q) ||
          a.managerName.toLowerCase().includes(q) ||
          a.department.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") {
        cmp = new Date(a.requestDate).getTime() - new Date(b.requestDate).getTime();
      } else {
        cmp = a.learnerName.localeCompare(b.learnerName);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [approvals, activeTab, departmentFilter, managerFilter, searchQuery, sortField, sortDirection]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "approved" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(`Failed to approve: ${err.error || res.statusText}`);
        return;
      }
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: "approved" as ApprovalStatus, decidedAt: new Date().toISOString() }
            : a
        )
      );
      setConfirmApproveId(null);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectionReason.trim()) return;
    setActionLoading(rejectingId);
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rejectingId,
          status: "rejected",
          rejection_reason: rejectionReason.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(`Failed to reject: ${err.error || res.statusText}`);
        return;
      }
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === rejectingId
            ? {
                ...a,
                status: "rejected" as ApprovalStatus,
                decidedAt: new Date().toISOString(),
                rejectionReason: rejectionReason.trim(),
              }
            : a
        )
      );
      setRejectModalOpen(false);
      setRejectingId(null);
      setRejectionReason("");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (id: string) => {
    setRejectingId(id);
    setRejectionReason("");
    setRejectModalOpen(true);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: approvals.filter((a) => a.status === "pending").length },
    { key: "approved", label: "Approved", count: approvals.filter((a) => a.status === "approved").length },
    { key: "rejected", label: "Rejected", count: approvals.filter((a) => a.status === "rejected").length },
    { key: "all", label: "All", count: approvals.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardCheck className="h-8 w-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">All Enrollment Approvals</h1>
        </div>
        <p className="text-gray-500 mt-1">
          Organization-wide view of all enrollment approval requests across departments
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Pending Requests",
            value: stats.pending,
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "Approved This Month",
            value: stats.approvedThisMonth,
            icon: ThumbsUp,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "Rejected This Month",
            value: stats.rejectedThisMonth,
            icon: ThumbsDown,
            color: "text-red-600",
            bg: "bg-red-50",
          },
          {
            label: "Avg Response Time",
            value: `${stats.avgResponseHours}h`,
            icon: Timer,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={cn("rounded-lg p-3", stat.bg)}>
                <stat.icon className={cn("h-6 w-6", stat.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "relative px-5 py-3 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
                  activeTab === tab.key
                    ? "bg-indigo-100 text-indigo-600"
                    : "bg-gray-100 text-gray-500"
                )}
              >
                {tab.count}
              </span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search, Filters & Sort */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by learner, course, manager, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Sort by:</span>
            <button
              onClick={() => toggleSort("date")}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                sortField === "date"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              Date
              <ArrowUpDown className="h-3 w-3" />
            </button>
            <button
              onClick={() => toggleSort("name")}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                sortField === "name"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              Name
              <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Department & Manager Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Managers</option>
              {managers.map((mgr) => (
                <option key={mgr} value={mgr}>
                  {mgr}
                </option>
              ))}
            </select>
          </div>
          {(departmentFilter !== "all" || managerFilter !== "all") && (
            <button
              onClick={() => {
                setDepartmentFilter("all");
                setManagerFilter("all");
              }}
              className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
            >
              <X className="h-3 w-3" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Approval Cards */}
      <div className="space-y-4">
        {filteredApprovals.map((approval) => {
          const config = statusConfig[approval.status];
          return (
            <div
              key={approval.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {/* Left: Learner info */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {approval.learnerInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">{approval.learnerName}</h3>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                          config.bg,
                          config.text
                        )}
                      >
                        <config.icon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">{approval.courseTitle}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5">{approval.courseCategory}</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {approval.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {approval.managerName}
                      </span>
                      <span>Requested: {formatDate(approval.requestDate)}</span>
                      {approval.decidedAt && (
                        <span>Decided: {formatDate(approval.decidedAt)}</span>
                      )}
                    </div>
                    <div className="mt-3 rounded-lg bg-gray-50 p-3">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium text-gray-700">Reason: </span>
                        {approval.reason}
                      </p>
                    </div>
                    {approval.rejectionReason && (
                      <div className="mt-2 rounded-lg bg-red-50 p-3">
                        <p className="text-sm text-red-700">
                          <span className="font-medium">Rejection Reason: </span>
                          {approval.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                {approval.status === "pending" && (
                  <div className="flex shrink-0 items-center gap-2 lg:ml-4">
                    {confirmApproveId === approval.id ? (
                      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                        <span className="text-sm text-green-700">Confirm approval?</span>
                        <button
                          onClick={() => handleApprove(approval.id)}
                          disabled={actionLoading === approval.id}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading === approval.id ? "Approving..." : "Yes, Approve"}
                        </button>
                        <button
                          onClick={() => setConfirmApproveId(null)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmApproveId(approval.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => openRejectModal(approval.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredApprovals.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
            <ClipboardCheck className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">No approval requests found.</p>
            <p className="text-sm text-gray-400">
              {searchQuery || departmentFilter !== "all" || managerFilter !== "all"
                ? "Try adjusting your search or filter criteria."
                : "No requests to display."}
            </p>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-100 p-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Reject Request</h2>
              </div>
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectingId(null);
                  setRejectionReason("");
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {rejectingId && (
                <div className="mb-4 rounded-lg bg-gray-50 p-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Learner:</span>{" "}
                    {approvals.find((a) => a.id === rejectingId)?.learnerName}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Course:</span>{" "}
                    {approvals.find((a) => a.id === rejectingId)?.courseTitle}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Department:</span>{" "}
                    {approvals.find((a) => a.id === rejectingId)?.department}
                  </p>
                </div>
              )}
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a reason for rejecting this enrollment request..."
                rows={4}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              {rejectionReason.trim() === "" && (
                <p className="mt-1 text-xs text-gray-400">A reason is required to reject a request.</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-6">
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectingId(null);
                  setRejectionReason("");
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || actionLoading !== null}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
                  rejectionReason.trim() && actionLoading === null
                    ? "bg-red-600 hover:bg-red-700"
                    : "cursor-not-allowed bg-red-300"
                )}
              >
                {actionLoading ? "Rejecting..." : "Reject Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
