"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ILTLocationType } from "@/types/database";
import {
  PROVIDER_OPTIONS,
  type CourseOption,
  type InstructorOption,
  type SessionItem,
} from "./sessions-shared";

interface CreateSessionModalProps {
  courses: CourseOption[];
  instructors: InstructorOption[];
  onClose: () => void;
  /** Called with the created session; the parent prepends it to its list. */
  onCreated: (session: SessionItem) => void;
}

export default function CreateSessionModal({
  courses,
  instructors,
  onClose,
  onCreated,
}: CreateSessionModalProps) {
  const [formData, setFormData] = useState({
    course_id: "",
    title: "",
    description: "",
    session_date: "",
    start_time: "",
    end_time: "",
    timezone: "America/New_York",
    location_type: "virtual" as ILTLocationType,
    location_details: "",
    meeting_url: "",
    meeting_provider: "",
    auto_create_meeting: true,
    max_capacity: 30,
    instructor: "",
    is_free: false,
    is_shared: false,
  });

  async function handleCreateSession() {
    const courseName = courses.find((c) => c.id === formData.course_id)?.title || "Unknown Course";
    const instructorName = instructors.find((i) => i.id === formData.instructor)?.name || "TBD";

    try {
      const res = await fetch("/api/ilt-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: formData.course_id,
          title: formData.title,
          description: formData.description,
          session_date: formData.session_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          timezone: formData.timezone,
          location_type: formData.location_type,
          location_details: formData.location_details,
          meeting_url: formData.meeting_url || null,
          meeting_provider: formData.meeting_provider || null,
          auto_create_meeting: formData.auto_create_meeting,
          max_capacity: formData.max_capacity,
          instructor_id: formData.instructor || null,
          is_free: formData.is_free,
          is_shared: formData.is_shared,
        }),
      });

      if (!res.ok) throw new Error("Failed to create session");

      const created = await res.json();

      onCreated({
        id: created.id,
        course_id: created.course_id,
        course_title: courseName,
        title: created.title,
        description: created.description,
        instructor_name: instructorName,
        session_date: created.session_date,
        start_time: created.start_time,
        end_time: created.end_time,
        timezone: created.timezone,
        location_type: created.location_type,
        location_details: created.location_details,
        meeting_url: created.meeting_url,
        meeting_provider: created.meeting_provider || null,
        meeting_id: created.meeting_id || null,
        meeting_password: created.meeting_password || null,
        recording_url: created.recording_url || null,
        max_capacity: created.max_capacity,
        registered_count: 0,
        status: "scheduled",
        attendees: [],
      });
      onClose();
    } catch (err) {
      console.error("Error creating session:", err);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Create New Session</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Course</label>
              <select
                value={formData.course_id}
                onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select a course...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Session Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="e.g., Cloud Security - Cohort C"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={formData.session_date}
                  onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Timezone</label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Time</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Time</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Location Type</label>
              <select
                value={formData.location_type}
                onChange={(e) => setFormData({ ...formData, location_type: e.target.value as ILTLocationType })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="virtual">Virtual</option>
                <option value="in_person">In-Person</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Location Details</label>
              <input
                type="text"
                value={formData.location_details}
                onChange={(e) => setFormData({ ...formData, location_details: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder={formData.location_type === "virtual" ? "e.g., Zoom Meeting" : "e.g., Building A, Room 301"}
              />
            </div>
            {(formData.location_type === "virtual" || formData.location_type === "hybrid") && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Meeting Provider</label>
                  <select
                    value={formData.meeting_provider}
                    onChange={(e) => setFormData({ ...formData, meeting_provider: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {formData.meeting_provider === "custom" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Meeting URL</label>
                    <input
                      type="url"
                      value={formData.meeting_url}
                      onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="https://..."
                    />
                  </div>
                )}
                {formData.meeting_provider && formData.meeting_provider !== "custom" && (
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-3">
                    <input
                      type="checkbox"
                      checked={formData.auto_create_meeting}
                      onChange={(e) => setFormData({ ...formData, auto_create_meeting: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Auto-create meeting</span>
                      <p className="text-xs text-gray-500">Requires {PROVIDER_OPTIONS.find(o => o.value === formData.meeting_provider)?.label} integration to be configured</p>
                    </div>
                  </label>
                )}
                {!formData.meeting_provider && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Meeting URL (optional)</label>
                    <input
                      type="url"
                      value={formData.meeting_url}
                      onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="https://..."
                    />
                  </div>
                )}
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Capacity</label>
              <input
                type="number"
                value={formData.max_capacity}
                onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) || 0 })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Instructor</label>
              <select
                value={formData.instructor}
                onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select instructor...</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.is_free}
                  onChange={(e) => setFormData({ ...formData, is_free: e.target.checked })}
                />
                Free webinar (no cost)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.is_shared}
                  onChange={(e) => setFormData({ ...formData, is_shared: e.target.checked })}
                />
                Offer to all client instances (they opt in)
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateSession}
            disabled={!formData.course_id || !formData.title || !formData.session_date}
          >
            Create Session
          </Button>
        </div>
      </div>
    </div>
  );
}
