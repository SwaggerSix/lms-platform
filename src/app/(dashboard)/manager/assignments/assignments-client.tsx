"use client";

import { useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  MoreHorizontal,
  X,
  ChevronDown,
  Trash2,
  CalendarPlus,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDate, formatPercent } from "@/utils/format";
import { useToast } from "@/components/ui/toast";

export interface Assignment {
  id: string;
  courseName: string;
  assignedTo: string;
  assignedToAvatar: string;
  assignedDate: string;
  dueDate: string;
  status: "active" | "completed" | "overdue";
  progress: number;
  priority: "high" | "medium" | "low";
}

export interface Course {
  id: string;
  name: string;
  duration: string;
  category: string;
}

export interface TeamMemberOption {
  id: string;
  name: string;
}

interface AssignmentsClientProps {
  assignments: Assignment[];
  courses: Course[];
  teamMembers: TeamMemberOption[];
}

const priorityStyles: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-gray-100 text-gray-600",
};

const statusStyles: Record<string, string> = {
  active: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

export default function AssignmentsClient({
  assignments,
  courses,
  teamMembers,
}: AssignmentsClientProps) {
  const [localAssignments, setLocalAssignments] = useState<Assignment[]>(assignments);
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "overdue">("active");
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Modal form state
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [notes, setNotes] = useState("");

  const filteredAssignments = localAssignments.filter((a) => {
    const matchesTab = a.status === activeTab;
    const matchesSearch =
      a.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.assignedTo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const tabCounts = {
    active: localAssignments.filter((a) => a.status === "active").length,
    completed: localAssignments.filter((a) => a.status === "completed").length,
    overdue: localAssignments.filter((a) => a.status === "overdue").length,
  };

  const toggleAssignmentSelect = (id: string) => {
    setSelectedAssignments((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllAssignments = () => {
    if (selectedAssignments.length === filteredAssignments.length) {
      setSelectedAssignments([]);
    } else {
      setSelectedAssignments(filteredAssignments.map((a) => a.id));
    }
  };

  const toggleMemberSelect = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const [assigning, setAssigning] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const toast = useToast();

  // Extend deadline modal state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDate, setExtendDate] = useState("");
  const [extendTargetIds, setExtendTargetIds] = useState<string[]>([]);

  // Cancel confirmation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetIds, setCancelTargetIds] = useState<string[]>([]);

  const handleSendReminder = async (assignmentIds: string[]) => {
    setActionLoading("reminder");
    try {
      const targets = localAssignments.filter((a) => assignmentIds.includes(a.id));
      await Promise.all(
        targets.map((a) =>
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_name: a.assignedTo,
              type: "reminder",
              message: `Reminder: "${a.courseName}" is due ${a.dueDate}.`,
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
      toast.success(`Reminder sent to ${targets.length} user(s).`);
    } catch (error) {
      console.error("Send reminder failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send reminder");
    } finally {
      setActionLoading(null);
      setShowBulkActions(false);
    }
  };

  const openExtendModal = (assignmentIds: string[]) => {
    setExtendTargetIds(assignmentIds);
    setExtendDate("");
    setShowExtendModal(true);
    setShowBulkActions(false);
  };

  const handleExtendDeadline = async () => {
    if (!extendDate) {
      toast.error("Please select a new deadline date.");
      return;
    }
    setActionLoading("extend");
    try {
      await Promise.all(
        extendTargetIds.map((id) =>
          fetch("/api/enrollments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enrollment_id: id,
              due_date: extendDate,
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
      setLocalAssignments((prev) =>
        prev.map((a) => extendTargetIds.includes(a.id) ? { ...a, dueDate: extendDate } : a)
      );
      toast.success(`Deadline extended to ${extendDate} for ${extendTargetIds.length} assignment(s).`);
      setShowExtendModal(false);
    } catch (error) {
      console.error("Extend deadline failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to extend deadline");
    } finally {
      setActionLoading(null);
    }
  };

  const openCancelModal = (assignmentIds: string[]) => {
    setCancelTargetIds(assignmentIds);
    setShowCancelModal(true);
    setShowBulkActions(false);
  };

  const handleCancelAssignment = async () => {
    setActionLoading("cancel");
    try {
      await Promise.all(
        cancelTargetIds.map((id) =>
          fetch("/api/enrollments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enrollment_id: id,
              status: "cancelled",
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || "Failed to cancel assignment");
            }
            return res.json();
          })
        )
      );
      setLocalAssignments((prev) => prev.filter((a) => !cancelTargetIds.includes(a.id)));
      setSelectedAssignments((prev) => prev.filter((id) => !cancelTargetIds.includes(id)));
      toast.success(`${cancelTargetIds.length} assignment(s) cancelled.`);
      setShowCancelModal(false);
    } catch (error) {
      console.error("Cancel assignment failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel assignment");
    } finally {
      setActionLoading(null);
    }
  };

  const resetModal = () => {
    setShowModal(false);
    setCourseSearch("");
    setSelectedCourse("");
    setSelectedMembers([]);
    setDueDate("");
    setPriority("medium");
    setNotes("");
  };

  const handleAssignCourse = async () => {
    if (!selectedCourse || selectedMembers.length === 0 || !dueDate) return;
    setAssigning(true);
    try {
      const results = await Promise.all(
        selectedMembers.map((userId) =>
          fetch('/api/enrollments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              course_id: selectedCourse,
              user_id: userId,
              due_date: dueDate,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || `Failed to assign for user ${userId}`);
            }
            return res.json();
          })
        )
      );
      const courseName = courses.find((c) => c.id === selectedCourse)?.name || "Unknown Course";
      const newAssignments: Assignment[] = selectedMembers.map((userId, idx) => {
        const member = teamMembers.find((m) => m.id === userId);
        return {
          id: results[idx]?.id || crypto.randomUUID(),
          courseName,
          assignedTo: member?.name || userId,
          assignedToAvatar: (member?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
          assignedDate: new Date().toISOString().split("T")[0],
          dueDate,
          status: "active" as const,
          progress: 0,
          priority: priority as "high" | "medium" | "low",
        };
      });
      setLocalAssignments((prev) => [...prev, ...newAssignments]);
      resetModal();
    } catch (error) {
      console.error('Assignment failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to assign course');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BookOpen className="h-8 w-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Course Assignments
            </h1>
          </div>
          <p className="text-gray-500 mt-1">
            Manage and track course assignments for your team
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Assign Course
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-6 border-b border-gray-200">
        {(["active", "completed", "overdue"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSelectedAssignments([]);
            }}
            className={cn(
              "relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors",
              activeTab === tab
                ? "text-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab === "active" && <Clock className="h-4 w-4" />}
            {tab === "completed" && <CheckCircle2 className="h-4 w-4" />}
            {tab === "overdue" && <AlertTriangle className="h-4 w-4" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                activeTab === tab
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              {tabCounts[tab]}
            </span>
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
            )}
          </button>
        ))}
      </div>

      {/* Search & Bulk Actions */}
      <div className="mb-4 flex items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search assignments"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        {selectedAssignments.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Bulk Actions ({selectedAssignments.length})
              <ChevronDown className="h-4 w-4" />
            </button>
            {showBulkActions && (
              <div className="absolute right-0 top-10 z-10 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => openExtendModal(selectedAssignments)}
                  disabled={actionLoading !== null}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Extend Deadline
                </button>
                <button
                  onClick={() => handleSendReminder(selectedAssignments)}
                  disabled={actionLoading !== null}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {actionLoading === "reminder" ? "Sending..." : "Send Reminder"}
                </button>
                <button
                  onClick={() => openCancelModal(selectedAssignments)}
                  disabled={actionLoading !== null}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Cancel Assignments
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assignments Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      filteredAssignments.length > 0 &&
                      selectedAssignments.length === filteredAssignments.length
                    }
                    onChange={toggleAllAssignments}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Course
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Assigned To
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Assigned Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Due Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Progress
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAssignments.map((assignment) => (
                <tr
                  key={assignment.id}
                  className={cn(
                    "transition-colors hover:bg-gray-50",
                    activeTab === "overdue" && "bg-red-50/30"
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedAssignments.includes(assignment.id)}
                      onChange={() => toggleAssignmentSelect(assignment.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {assignment.courseName}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {assignment.assignedToAvatar}
                      </div>
                      <span className="text-sm text-gray-700">
                        {assignment.assignedTo}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(assignment.assignedDate)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-sm",
                      assignment.status === "overdue"
                        ? "font-semibold text-red-600"
                        : "text-gray-500"
                    )}
                  >
                    {formatDate(assignment.dueDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        priorityStyles[assignment.priority]
                      )}
                    >
                      {assignment.priority.charAt(0).toUpperCase() +
                        assignment.priority.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            assignment.progress === 100
                              ? "bg-green-500"
                              : assignment.status === "overdue"
                              ? "bg-red-500"
                              : "bg-indigo-500"
                          )}
                          style={{ width: `${assignment.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600">
                        {formatPercent(assignment.progress)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        statusStyles[assignment.status]
                      )}
                    >
                      {assignment.status.charAt(0).toUpperCase() +
                        assignment.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Send Reminder"
                        aria-label="Send reminder"
                        onClick={() => handleSendReminder([assignment.id])}
                        disabled={actionLoading !== null}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        title="Extend Deadline"
                        aria-label="Extend deadline"
                        onClick={() => openExtendModal([assignment.id])}
                        disabled={actionLoading !== null}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                      >
                        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        title="Cancel"
                        aria-label="Cancel assignment"
                        onClick={() => openCancelModal([assignment.id])}
                        disabled={actionLoading !== null}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredAssignments.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            No {activeTab} assignments found.
          </div>
        )}
      </div>

      {/* Assign Course Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-label="Assign Course" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Assign Course
              </h2>
              <button
                onClick={resetModal}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close assign course dialog"
              >
                <X className="h-5 w-5" aria-hidden="true" />
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
                  {filteredCourses.map((course) => (
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
                        <p className="text-xs text-gray-500">
                          {course.category} - {course.duration}
                        </p>
                      </div>
                      {selectedCourse === course.id && (
                        <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Team Members */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Select Team Members
                </label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200">
                  {teamMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => toggleMemberSelect(member.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-700">{member.name}</span>
                    </label>
                  ))}
                </div>
                {selectedMembers.length > 0 && (
                  <p className="mt-1 text-xs text-indigo-600">
                    {selectedMembers.length} member(s) selected
                  </p>
                )}
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

              {/* Priority */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes or instructions for the assignees..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={resetModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignCourse}
                disabled={!selectedCourse || selectedMembers.length === 0 || !dueDate || assigning}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors",
                  selectedCourse && selectedMembers.length > 0 && dueDate && !assigning
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-indigo-300 cursor-not-allowed"
                )}
              >
                {assigning ? "Assigning..." : "Assign Course"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Deadline Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-label="Extend Deadline" className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Extend Deadline</h2>
              <button
                onClick={() => setShowExtendModal(false)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close extend deadline dialog"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                Select a new deadline for {extendTargetIds.length} assignment(s).
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">New Deadline</label>
                <input
                  type="date"
                  value={extendDate}
                  onChange={(e) => setExtendDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowExtendModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExtendDeadline}
                disabled={!extendDate || actionLoading === "extend"}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
              >
                {actionLoading === "extend" ? "Extending..." : "Extend Deadline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-label="Cancel Assignment" className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Cancel Assignment</h2>
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close cancel assignment dialog"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p>
                  Are you sure you want to cancel {cancelTargetIds.length} assignment(s)? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Keep Assignments
              </button>
              <button
                onClick={handleCancelAssignment}
                disabled={actionLoading === "cancel"}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === "cancel" ? "Cancelling..." : "Cancel Assignments"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
