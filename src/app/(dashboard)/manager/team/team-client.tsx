"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  BarChart3,
  ShieldCheck,
  Activity,
  Search,
  Filter,
  LayoutGrid,
  List,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Send,
  BookOpen,
  Eye,
  ChevronDown,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDate, formatRelativeTime, formatPercent } from "@/utils/format";
import { useToast } from "@/components/ui/toast";

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  avatar: string;
  coursesInProgress: number;
  coursesCompleted: number;
  isCompliant: boolean;
  overallProgress: number;
  lastActive: string;
  status: "active" | "inactive" | "on-leave";
}

export interface CourseOption {
  id: string;
  name: string;
  duration: string;
  category: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-700",
  "on-leave": "bg-amber-100 text-amber-700",
};

export default function TeamClient({
  members,
  courses = [],
}: {
  members: TeamMember[];
  courses?: CourseOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [complianceFilter, setComplianceFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);

  // Profile modal state
  const [profileMember, setProfileMember] = useState<TeamMember | null>(null);

  // Assign course modal state
  const [assignMember, setAssignMember] = useState<TeamMember | null>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Reminder loading state
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      `${member.firstName} ${member.lastName} ${member.jobTitle} ${member.department}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || member.status === statusFilter;
    const matchesCompliance =
      complianceFilter === "all" ||
      (complianceFilter === "compliant" && member.isCompliant) ||
      (complianceFilter === "non-compliant" && !member.isCompliant);
    const matchesActivity =
      activityFilter === "all" ||
      (activityFilter === "recent" &&
        new Date(member.lastActive) >
          new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) ||
      (activityFilter === "inactive" &&
        new Date(member.lastActive) <=
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    return matchesSearch && matchesStatus && matchesCompliance && matchesActivity;
  });

  const stats = {
    teamSize: members.length,
    avgCompletion: Math.round(
      members.reduce((sum, m) => sum + m.overallProgress, 0) /
        (members.length || 1)
    ),
    complianceRate: Math.round(
      (members.filter((m) => m.isCompliant).length /
        (members.length || 1)) *
        100
    ),
    activeLearners: members.filter(
      (m) =>
        new Date(m.lastActive) >
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length,
  };

  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const handleViewProfile = (member: TeamMember) => {
    setProfileMember(member);
    setOpenActionMenu(null);
  };

  const handleAssignCourse = (member: TeamMember) => {
    setAssignMember(member);
    setSelectedCourse("");
    setCourseSearch("");
    setDueDate("");
    setOpenActionMenu(null);
  };

  const handleSubmitAssignment = async () => {
    if (!assignMember || !selectedCourse || !dueDate) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: selectedCourse,
          user_id: assignMember.id,
          due_date: dueDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to assign course");
      }
      toast.success(
        `Course assigned to ${assignMember.firstName} ${assignMember.lastName}.`
      );
      setAssignMember(null);
    } catch (error) {
      console.error("Assignment failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to assign course"
      );
    } finally {
      setAssigning(false);
    }
  };

  const handleSendReminder = async (member: TeamMember) => {
    setReminderLoading(member.id);
    setOpenActionMenu(null);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: member.id,
          user_name: `${member.firstName} ${member.lastName}`,
          type: "reminder",
          message: `Reminder: Please continue your learning activities. You have ${member.coursesInProgress} course(s) in progress.`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send reminder");
      }
      toast.success(
        `Reminder sent to ${member.firstName} ${member.lastName}.`
      );
    } catch (error) {
      console.error("Send reminder failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send reminder"
      );
    } finally {
      setReminderLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Users className="h-8 w-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">My Team</h1>
          <span className="ml-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
            {stats.teamSize} members
          </span>
        </div>
        <p className="text-gray-500 mt-1">
          Monitor your team&apos;s learning progress and compliance status
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Team Size",
            value: stats.teamSize,
            icon: Users,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
          {
            label: "Avg Completion Rate",
            value: formatPercent(stats.avgCompletion),
            icon: BarChart3,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Compliance Rate",
            value: formatPercent(stats.complianceRate),
            icon: ShieldCheck,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Active Learners",
            value: stats.activeLearners,
            icon: Activity,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {stat.value}
                </p>
              </div>
              <div className={cn("rounded-lg p-3", stat.bg)}>
                <stat.icon className={cn("h-6 w-6", stat.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on-leave">On Leave</option>
            </select>
            <select
              value={complianceFilter}
              onChange={(e) => setComplianceFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Compliance</option>
              <option value="compliant">Compliant</option>
              <option value="non-compliant">Non-Compliant</option>
            </select>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Activity</option>
              <option value="recent">Active (last 3 days)</option>
              <option value="inactive">Inactive (7+ days)</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white p-1">
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "rounded-md p-2 transition-colors",
              viewMode === "table"
                ? "bg-indigo-100 text-indigo-600"
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-md p-2 transition-colors",
              viewMode === "grid"
                ? "bg-indigo-100 text-indigo-600"
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Team Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Department
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    In Progress
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Compliance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Last Active
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                          {member.avatar}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {member.jobTitle}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
                            statusColors[member.status]
                          )}
                        >
                          {member.status === "on-leave"
                            ? "On Leave"
                            : member.status.charAt(0).toUpperCase() +
                              member.status.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {member.department}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-sm font-medium text-blue-700">
                        {member.coursesInProgress}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-sm font-medium text-green-700">
                        {member.coursesCompleted}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {member.isCompliant ? (
                        <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="mx-auto h-5 w-5 text-red-500" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              member.overallProgress >= 75
                                ? "bg-green-500"
                                : member.overallProgress >= 50
                                ? "bg-amber-500"
                                : "bg-red-500"
                            )}
                            style={{ width: `${member.overallProgress}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {formatPercent(member.overallProgress)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatRelativeTime(member.lastActive)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenActionMenu(
                              openActionMenu === member.id ? null : member.id
                            )
                          }
                          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        {openActionMenu === member.id && (
                          <div className="absolute right-0 top-8 z-10 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                            <button
                              onClick={() => handleViewProfile(member)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="h-4 w-4" />
                              View Profile
                            </button>
                            <button
                              onClick={() => handleAssignCourse(member)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <BookOpen className="h-4 w-4" />
                              Assign Course
                            </button>
                            <button
                              onClick={() => handleSendReminder(member)}
                              disabled={reminderLoading === member.id}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {reminderLoading === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                              {reminderLoading === member.id
                                ? "Sending..."
                                : "Send Reminder"}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredMembers.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              No team members match your filters.
            </div>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {member.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{member.jobTitle}</p>
                  </div>
                </div>
                {member.isCompliant ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>

              <div className="mb-3 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    statusColors[member.status]
                  )}
                >
                  {member.status === "on-leave"
                    ? "On Leave"
                    : member.status.charAt(0).toUpperCase() +
                      member.status.slice(1)}
                </span>
                <span className="text-xs text-gray-400">
                  {member.department}
                </span>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-center">
                  <p className="text-lg font-bold text-blue-700">
                    {member.coursesInProgress}
                  </p>
                  <p className="text-xs text-blue-600">In Progress</p>
                </div>
                <div className="rounded-lg bg-green-50 p-2 text-center">
                  <p className="text-lg font-bold text-green-700">
                    {member.coursesCompleted}
                  </p>
                  <p className="text-xs text-green-600">Completed</p>
                </div>
              </div>

              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Overall Progress
                  </span>
                  <span className="text-xs font-semibold text-gray-700">
                    {formatPercent(member.overallProgress)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      member.overallProgress >= 75
                        ? "bg-green-500"
                        : member.overallProgress >= 50
                        ? "bg-amber-500"
                        : "bg-red-500"
                    )}
                    style={{ width: `${member.overallProgress}%` }}
                  />
                </div>
              </div>

              <p className="mb-4 text-xs text-gray-400">
                Last active: {formatRelativeTime(member.lastActive)}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => handleViewProfile(member)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Eye className="mr-1 inline h-3 w-3" />
                  Profile
                </button>
                <button
                  onClick={() => handleAssignCourse(member)}
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  <BookOpen className="mr-1 inline h-3 w-3" />
                  Assign
                </button>
                <button
                  onClick={() => handleSendReminder(member)}
                  disabled={reminderLoading === member.id}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 disabled:opacity-50"
                >
                  {reminderLoading === member.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          ))}
          {filteredMembers.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500">
              No team members match your filters.
            </div>
          )}
        </div>
      )}

      {/* Profile Detail Modal */}
      {profileMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Team Member Profile
              </h2>
              <button
                onClick={() => setProfileMember(null)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700">
                  {profileMember.avatar}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {profileMember.firstName} {profileMember.lastName}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {profileMember.jobTitle}
                  </p>
                  <p className="text-sm text-gray-400">
                    {profileMember.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Department
                  </p>
                  <p className="mt-1 font-medium text-gray-900">
                    {profileMember.department}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Status
                  </p>
                  <p className="mt-1">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        statusColors[profileMember.status]
                      )}
                    >
                      {profileMember.status === "on-leave"
                        ? "On Leave"
                        : profileMember.status.charAt(0).toUpperCase() +
                          profileMember.status.slice(1)}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Courses In Progress
                  </p>
                  <p className="mt-1 text-lg font-bold text-blue-700">
                    {profileMember.coursesInProgress}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Courses Completed
                  </p>
                  <p className="mt-1 text-lg font-bold text-green-700">
                    {profileMember.coursesCompleted}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Overall Progress
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          profileMember.overallProgress >= 75
                            ? "bg-green-500"
                            : profileMember.overallProgress >= 50
                            ? "bg-amber-500"
                            : "bg-red-500"
                        )}
                        style={{
                          width: `${profileMember.overallProgress}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-700">
                      {formatPercent(profileMember.overallProgress)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Compliance
                  </p>
                  <p className="mt-1 flex items-center gap-1">
                    {profileMember.isCompliant ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-700">
                          Compliant
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-red-700">
                          Non-Compliant
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Last Active
                  </p>
                  <p className="mt-1 text-sm text-gray-700">
                    {formatRelativeTime(profileMember.lastActive)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setProfileMember(null);
                  router.push(`/profile/${profileMember.id}`);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                View Full Profile
              </button>
              <button
                onClick={() => setProfileMember(null)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Course Modal */}
      {assignMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Assign Course to {assignMember.firstName}{" "}
                {assignMember.lastName}
              </h2>
              <button
                onClick={() => setAssignMember(null)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-5">
              {/* Select Course */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Select Course
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-gray-200">
                  {filteredCourses.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-gray-400">
                      No courses available
                    </p>
                  ) : (
                    filteredCourses.map((course) => (
                      <button
                        key={course.id}
                        onClick={() => setSelectedCourse(course.id)}
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50",
                          selectedCourse === course.id &&
                            "bg-indigo-50 text-indigo-700"
                        )}
                      >
                        <div>
                          <p className="font-medium">{course.name}</p>
                          <p className="text-xs text-gray-400">
                            {course.category} - {course.duration}
                          </p>
                        </div>
                        {selectedCourse === course.id && (
                          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setAssignMember(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAssignment}
                disabled={!selectedCourse || !dueDate || assigning}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors",
                  selectedCourse && dueDate && !assigning
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-indigo-300 cursor-not-allowed"
                )}
              >
                {assigning ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Assigning...
                  </span>
                ) : (
                  "Assign Course"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
