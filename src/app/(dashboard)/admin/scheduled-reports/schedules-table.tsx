"use client";

import { useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "@/utils/cn";
import {
  FormatIcon,
  formatDate,
  formatDateTime,
  frequencyColors,
  frequencyLabels,
  reportTypeConfig,
  type RunHistoryEntry,
  type ScheduledReportWithHistory,
} from "./reports-shared";

interface SchedulesTableProps {
  reports: ScheduledReportWithHistory[];
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
  onViewRun: (report: ScheduledReportWithHistory, entry: RunHistoryEntry) => void;
}

export default function SchedulesTable({
  reports,
  onToggleActive,
  onDelete,
  onViewRun,
}: SchedulesTableProps) {
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [hoveredRecipients, setHoveredRecipients] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Report Schedules</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Report Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Frequency</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Next Run</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Last Run</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Recipients</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Format</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports.map((report) => {
              const typeConf = reportTypeConfig[report.report_type] || reportTypeConfig.custom;
              const lastRunSuccess = report.runHistory.length > 0 ? report.runHistory[0].status === "success" : null;

              return (
                <tr key={report.id} className="group">
                  {/* Expand toggle + name */}
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                      aria-expanded={expandedReport === report.id}
                      className="flex items-center gap-2 text-left"
                    >
                      {expandedReport === report.id ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{report.name}</p>
                        {report.description && (
                          <p className="text-xs text-gray-500 max-w-[200px] truncate">{report.description}</p>
                        )}
                      </div>
                    </button>
                  </td>

                  {/* Type badge */}
                  <td className="px-4 py-4">
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", typeConf.bg, typeConf.color)}>
                      {typeConf.label}
                    </span>
                  </td>

                  {/* Frequency badge */}
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        frequencyColors[report.schedule_frequency]
                      )}
                    >
                      {frequencyLabels[report.schedule_frequency]}
                    </span>
                  </td>

                  {/* Next run */}
                  <td className="px-4 py-4 text-sm text-gray-600">{formatDateTime(report.next_run_at)}</td>

                  {/* Last run with status indicator */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      {lastRunSuccess === true && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                      {lastRunSuccess === false && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                      <span className="text-sm text-gray-600">{formatDateTime(report.last_run_at)}</span>
                    </div>
                  </td>

                  {/* Recipients */}
                  <td className="px-4 py-4 text-center">
                    <div
                      className="relative inline-block"
                      onMouseEnter={() => setHoveredRecipients(report.id)}
                      onMouseLeave={() => setHoveredRecipients(null)}
                    >
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 cursor-default">
                        <Users className="h-3 w-3" />
                        {report.recipients.length}
                      </span>
                      {hoveredRecipients === report.id && (
                        <div className="absolute z-10 mt-1 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 shadow-lg">
                          {report.recipients.map((email) => (
                            <p key={email} className="whitespace-nowrap text-xs text-white">
                              {email}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Format */}
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <FormatIcon format={report.format} />
                      <span className="text-xs font-medium text-gray-600 uppercase">{report.format}</span>
                    </div>
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => onToggleActive(report.id)}
                      role="switch"
                      aria-checked={report.is_active}
                      aria-label={`${report.name} active`}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        report.is_active ? "bg-indigo-600" : "bg-gray-300"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                          report.is_active ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Delete"
                        onClick={() => onDelete(report.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete {report.name}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded Run History */}
      {expandedReport && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Run History &mdash; {reports.find((r) => r.id === expandedReport)?.name}
          </h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Run Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Records</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">File Size</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports
                  .find((r) => r.id === expandedReport)
                  ?.runHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-sm text-gray-700">{formatDate(entry.runDate)}</td>
                      <td className="px-4 py-2.5">
                        {entry.status === "success" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <CheckCircle className="h-3 w-3" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            <XCircle className="h-3 w-3" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm text-gray-700">{entry.records.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-sm text-gray-500">{entry.fileSize}</td>
                      <td className="px-4 py-2.5 text-right">
                        {entry.status === "success" ? (
                          <button
                            type="button"
                            onClick={() => {
                              const parent = reports.find((r) => r.id === expandedReport);
                              if (parent) onViewRun(parent, entry);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Eye className="h-3 w-3" /> View
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
