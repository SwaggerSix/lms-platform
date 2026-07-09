"use client";

import { useState } from "react";
import { Clock, Download, Mail, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ReportFrequency, ReportFormat } from "@/types/database";
import {
  dayOfWeekLabels,
  FormatIcon,
  getScheduleDescription,
  reportTypes,
  timezones,
  type ScheduledReportWithHistory,
} from "./reports-shared";

interface CreateScheduleModalProps {
  onClose: () => void;
  /** Called with the created schedule; the parent prepends it to its list. */
  onCreated: (report: ScheduledReportWithHistory) => void;
}

export default function CreateScheduleModal({ onClose, onCreated }: CreateScheduleModalProps) {
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("completion");
  const [formFrequency, setFormFrequency] = useState<ReportFrequency>("weekly");
  const [formDay, setFormDay] = useState<number>(1);
  const [formTime, setFormTime] = useState("09:00");
  const [formTimezone, setFormTimezone] = useState("America/New_York");
  const [formDelivery, setFormDelivery] = useState<"email" | "download" | "both">("email");
  const [formRecipients, setFormRecipients] = useState<string[]>([]);
  const [formRecipientInput, setFormRecipientInput] = useState("");
  const [formFormat, setFormFormat] = useState<ReportFormat>("pdf");
  // Default filter window: start of the current month through today.
  const [formDateFrom, setFormDateFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [formDateTo, setFormDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [formDepartment, setFormDepartment] = useState("all");
  const [formRole, setFormRole] = useState("all");
  const [formCourse, setFormCourse] = useState("all");

  const addRecipient = () => {
    const email = formRecipientInput.trim();
    if (email && email.includes("@") && !formRecipients.includes(email)) {
      setFormRecipients([...formRecipients, email]);
      setFormRecipientInput("");
    }
  };

  const removeRecipient = (email: string) => {
    setFormRecipients(formRecipients.filter((r) => r !== email));
  };

  const handleCreateSchedule = async () => {
    if (!formName.trim()) return;

    try {
      const res = await fetch("/api/scheduled-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          report_type: formType,
          filters: { date_range: `${formDateFrom}_to_${formDateTo}`, department: formDepartment, role: formRole, course: formCourse },
          schedule_frequency: formFrequency,
          schedule_day: formFrequency === "daily" ? null : formDay,
          schedule_time: formTime,
          schedule_timezone: formTimezone,
          delivery_method: formDelivery,
          recipients: formRecipients,
          format: formFormat,
        }),
      });

      if (!res.ok) throw new Error("Failed to create scheduled report");

      const { scheduled_report: created } = await res.json();

      onCreated({
        id: created.id,
        name: created.name,
        description: created.description,
        report_type: created.report_type,
        filters: created.filters,
        schedule_frequency: created.schedule_frequency,
        schedule_day: created.schedule_day,
        schedule_time: created.schedule_time,
        schedule_timezone: created.schedule_timezone,
        delivery_method: created.delivery_method,
        recipients: created.recipients,
        format: created.format,
        is_active: created.is_active,
        last_run_at: created.last_run_at,
        next_run_at: created.next_run_at,
        created_by: created.created_by,
        created_at: created.created_at,
        updated_at: created.updated_at,
        runHistory: [],
      });
      onClose();
    } catch (err) {
      console.error("Error creating scheduled report:", err);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Create Report Schedule"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreateSchedule} disabled={!formName.trim()}>
            Create Schedule
          </Button>
        </>
      }
    >
      <div className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Report Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Weekly Enrollment Summary"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Report Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {reportTypes.map((rt) => (
                <option key={rt.value} value={rt.value}>
                  {rt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Frequency + Day */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Frequency</label>
              <select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value as ReportFrequency)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>

            {/* Day selector -- varies by frequency */}
            {formFrequency !== "daily" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {formFrequency === "weekly" || formFrequency === "biweekly" ? "Day of Week" : "Day of Month"}
                </label>
                {formFrequency === "weekly" || formFrequency === "biweekly" ? (
                  <select
                    value={formDay}
                    onChange={(e) => setFormDay(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {dayOfWeekLabels.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={formDay}
                    onChange={(e) => setFormDay(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Time + Timezone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
              <select
                value={formTimezone}
                onChange={(e) => setFormTimezone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Delivery Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Method</label>
            <div className="flex gap-3">
              {(["email", "download", "both"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setFormDelivery(method)}
                  aria-pressed={formDelivery === method}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    formDelivery === method
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {method === "email" && <Mail className="h-4 w-4" />}
                    {method === "download" && <Download className="h-4 w-4" />}
                    {method === "both" && (
                      <>
                        <Mail className="h-3.5 w-3.5" />
                        <span>+</span>
                        <Download className="h-3.5 w-3.5" />
                      </>
                    )}
                    <span className="capitalize">{method}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipients</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={formRecipientInput}
                onChange={(e) => setFormRecipientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
                placeholder="Enter email address"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <Button variant="secondary" onClick={addRecipient}>
                Add
              </Button>
            </div>
            {formRecipients.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formRecipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700"
                  >
                    {email}
                    <button onClick={() => removeRecipient(email)} className="hover:text-primary-900">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Format</label>
            <div className="flex gap-3">
              {(["pdf", "csv", "xlsx"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormFormat(fmt)}
                  aria-pressed={formFormat === fmt}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    formFormat === fmt
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <FormatIcon format={fmt} />
                    <span className="uppercase">{fmt}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview Description */}
          <div className="rounded-lg bg-primary-50 border border-primary-200 px-4 py-3">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary-600 mt-0.5" />
              <p className="text-sm text-primary-700">
                {getScheduleDescription({
                  schedule_frequency: formFrequency,
                  schedule_day: formFrequency === "daily" ? null : formDay,
                  schedule_time: formTime,
                  schedule_timezone: formTimezone,
                  recipients: formRecipients,
                })}
              </p>
            </div>
          </div>

          {/* Filters Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Filters</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date Range From</label>
                <input
                  type="date"
                  value={formDateFrom}
                  onChange={(e) => setFormDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date Range To</label>
                <input
                  type="date"
                  value={formDateTo}
                  onChange={(e) => setFormDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                <select
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="all">All Departments</option>
                  <option value="executive">Executive</option>
                  <option value="hr">HR</option>
                  <option value="operations">Operations</option>
                  <option value="finance">Finance</option>
                  <option value="training-delivery">Training Delivery</option>
                  <option value="training-development">Training Development</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="all">All Roles</option>
                  <option value="instructor">Instructor</option>
                  <option value="learner">Learner</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Course</label>
                <select
                  value={formCourse}
                  onChange={(e) => setFormCourse(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="all">All Courses</option>
                  <option value="advanced-react">Advanced React Patterns</option>
                  <option value="cloud-arch">Cloud Architecture</option>
                  <option value="data-privacy">Data Privacy Essentials</option>
                  <option value="negotiation">Negotiation Skills</option>
                  <option value="workplace-safety">Workplace Safety 2026</option>
                </select>
              </div>
            </div>
          </div>
        </div>
    </Modal>
  );
}
