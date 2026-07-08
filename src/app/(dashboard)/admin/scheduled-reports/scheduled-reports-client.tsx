"use client";

import { useState } from "react";
import AdminAnalyticsTabs from "@/components/layout/admin-analytics-tabs";
import { AlertTriangle, Calendar, Plus, Send, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportViewerModal, type ReportColumn } from "@/components/ui/report-viewer-modal";
import {
  formatDate,
  formatDateTime,
  type RunHistoryEntry,
  type ScheduledReportWithHistory,
} from "./reports-shared";
import SchedulesTable from "./schedules-table";
import CreateScheduleModal from "./create-schedule-modal";

export interface ScheduledReportsClientProps {
  initialReports: ScheduledReportWithHistory[];
}

export default function ScheduledReportsClient({ initialReports }: ScheduledReportsClientProps) {
  const [reports, setReports] = useState(initialReports);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // In-app report viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerSubtitle, setViewerSubtitle] = useState<string | undefined>(undefined);
  const [viewerRows, setViewerRows] = useState<Record<string, unknown>[]>([]);
  const [viewerColumns, setViewerColumns] = useState<ReportColumn<Record<string, unknown>>[]>([]);

  const openRunViewer = async (
    parent: ScheduledReportWithHistory,
    entry: RunHistoryEntry
  ) => {
    setViewerOpen(true);
    setViewerLoading(true);
    setViewerTitle(parent.name);
    setViewerSubtitle(
      `Run ${formatDate(entry.runDate)} · ${entry.records.toLocaleString()} records · ${entry.fileSize}`
    );
    setViewerRows([]);
    setViewerColumns([]);
    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_type: parent.report_type, format: "json" }),
      });
      const data = await response.json();
      const rows: Record<string, unknown>[] = Array.isArray(data?.rows) ? data.rows : [];
      if (rows.length > 0) {
        const keys = Object.keys(rows[0]);
        setViewerColumns(
          keys.map((k) => ({
            key: k,
            label: k
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
          })) as ReportColumn<Record<string, unknown>>[]
        );
      }
      setViewerRows(rows);
    } catch {
      setViewerRows([]);
    } finally {
      setViewerLoading(false);
    }
  };

  // Stats
  const activeCount = reports.filter((r) => r.is_active).length;
  const reportsSentThisMonth = reports
    .flatMap((r) => r.runHistory)
    .filter((h) => {
      const d = new Date(h.runDate);
      return d.getMonth() === 2 && d.getFullYear() === 2026 && h.status === "success";
    }).length;
  const nextScheduled = reports
    .filter((r) => r.is_active && r.next_run_at)
    .sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime())[0];
  const failedDeliveries = reports
    .flatMap((r) => r.runHistory)
    .filter((h) => h.status === "failed").length;

  const toggleActive = async (id: string) => {
    const report = reports.find((r) => r.id === id);
    if (!report) return;

    const newIsActive = !report.is_active;

    try {
      const res = await fetch("/api/scheduled-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          is_active: newIsActive,
          next_run_at: newIsActive ? new Date().toISOString() : null,
        }),
      });

      if (!res.ok) throw new Error("Failed to toggle report status");

      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                is_active: newIsActive,
                next_run_at: newIsActive ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              }
            : r
        )
      );
    } catch (err) {
      console.error("Error toggling report active status:", err);
    }
  };

  const deleteReport = async (id: string) => {
    try {
      const res = await fetch(`/api/scheduled-reports?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete report");

      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Error deleting report:", err);
    }
  };

  return (
    <div className="space-y-8">
      <AdminAnalyticsTabs />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduled Reports</h1>
          <p className="mt-1 text-sm text-gray-500">Manage automated report delivery and scheduling</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          Create Schedule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
              <Calendar className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Schedules</p>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Send className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Reports Sent This Month</p>
              <p className="text-2xl font-bold text-gray-900">{reportsSentThisMonth}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
              <Timer className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Next Scheduled Run</p>
              <p className="text-sm font-semibold text-gray-900">
                {nextScheduled ? formatDateTime(nextScheduled.next_run_at) : "None"}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Failed Deliveries</p>
              <p className="text-2xl font-bold text-gray-900">{failedDeliveries}</p>
            </div>
          </div>
        </div>
      </div>

      <SchedulesTable
        reports={reports}
        onToggleActive={toggleActive}
        onDelete={deleteReport}
        onViewRun={openRunViewer}
      />

      {showCreateModal && (
        <CreateScheduleModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(report) => setReports((prev) => [report, ...prev])}
        />
      )}

      <ReportViewerModal
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title={viewerTitle}
        subtitle={viewerLoading ? `${viewerSubtitle ?? ""} · Loading…` : viewerSubtitle}
        rows={viewerRows}
        columns={viewerColumns}
      />
    </div>
  );
}
