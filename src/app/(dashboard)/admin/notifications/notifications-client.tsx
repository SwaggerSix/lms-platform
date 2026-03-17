"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Send,
  Clock,
  CheckCircle2,
  Users,
  X,
  Edit2,
  Trash2,
  Bell,
  Eye,
  Megaphone,
  Calendar,
  AlertTriangle,
  Mail,
  Settings,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  targetAudience: string;
  status: "Sent" | "Scheduled" | "Draft";
  sentDate: string | null;
  scheduledDate: string | null;
  viewCount: number;
  priority: "Normal" | "High" | "Urgent";
}

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  preview: string;
}

export interface NotificationsClientProps {
  announcements: Announcement[];
  templates: NotificationTemplate[];
}

const statusColors: Record<string, string> = {
  Sent: "bg-green-100 text-green-700",
  Scheduled: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-600",
};

const statusIcons: Record<string, React.ReactNode> = {
  Sent: <CheckCircle2 className="h-3 w-3" />,
  Scheduled: <Clock className="h-3 w-3" />,
  Draft: <Edit2 className="h-3 w-3" />,
};

const priorityColors: Record<string, string> = {
  Normal: "bg-gray-100 text-gray-600",
  High: "bg-amber-100 text-amber-700",
  Urgent: "bg-red-100 text-red-700",
};

const tabs = ["Announcements", "Templates", "Settings"] as const;

export default function NotificationsClient({ announcements, templates }: NotificationsClientProps) {
  const toast = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("Announcements");
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formAudience, setFormAudience] = useState("all");
  const [formAudienceType, setFormAudienceType] = useState("all");
  const [formSchedule, setFormSchedule] = useState<"now" | "later">("now");
  const [formDate, setFormDate] = useState("");
  const [formPriority, setFormPriority] = useState("Normal");
  const [saving, setSaving] = useState(false);

  // Edit announcement state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  // Template edit modal state
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templatePreview, setTemplatePreview] = useState("");

  // Settings state
  const [channels, setChannels] = useState([
    { label: "In-App Notifications", description: "Show notifications within the LMS platform", enabled: true, key: "in_app" },
    { label: "Email Notifications", description: "Send notifications via email", enabled: true, key: "email" },
    { label: "Browser Push Notifications", description: "Send push notifications to the browser", enabled: false, key: "push" },
  ]);
  const [quietFrom, setQuietFrom] = useState("22:00");
  const [quietTo, setQuietTo] = useState("07:00");
  const [digestFrequency, setDigestFrequency] = useState("daily");
  const [digestTime, setDigestTime] = useState("09:00");
  const [savingSettings, setSavingSettings] = useState(false);

  const resetForm = () => {
    setFormTitle("");
    setFormBody("");
    setFormAudience("all");
    setFormAudienceType("all");
    setFormSchedule("now");
    setFormDate("");
    setFormPriority("Normal");
    setShowForm(false);
  };

  const getAudience = () => {
    if (formAudienceType === "all") return "all";
    return formAudience;
  };

  const handleSendAnnouncement = async () => {
    if (!formTitle.trim() || !formBody.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          body: formBody,
          audience: getAudience(),
          priority: formPriority,
          scheduled_for: formSchedule === "later" ? formDate : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to send announcement");
        return;
      }
      resetForm();
      router.refresh();
    } catch {
      toast.error("Failed to send announcement");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsDraft = async () => {
    if (!formTitle.trim() || !formBody.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          body: formBody,
          audience: getAudience(),
          priority: formPriority,
          scheduled_for: formSchedule === "later" ? formDate : null,
          status: "draft",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save draft");
        return;
      }
      resetForm();
      router.refresh();
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handleEditAnnouncement = async (id: string) => {
    if (!editTitle.trim() || !editBody.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: editTitle, body: editBody }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to update announcement");
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      toast.error("Failed to update announcement");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const res = await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to delete announcement");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Failed to delete announcement");
    }
  };

  const openEditModal = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setEditTitle(announcement.title);
    setEditBody(announcement.body);
  };

  const openTemplateEdit = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description);
    setTemplatePreview(template.preview);
  };

  const handleSaveTemplate = () => {
    // Templates are static in the server component; close modal.
    // In a full implementation, this would call a templates API.
    setEditingTemplate(null);
  };

  const toggleChannel = (idx: number) => {
    setChannels((prev) => prev.map((ch, i) => (i === idx ? { ...ch, enabled: !ch.enabled } : ch)));
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const settings = {
        channels: channels.reduce((acc, ch) => ({ ...acc, [ch.key]: ch.enabled }), {}),
        quiet_hours: { from: quietFrom, to: quietTo },
        digest: { frequency: digestFrequency, send_time: digestTime },
      };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "notification_settings", value: settings }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save settings");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements &amp; Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">Manage platform announcements, notification templates, and delivery settings</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Announcement
        </button>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "border-b-2 pb-3 text-sm font-medium transition-colors",
                activeTab === tab ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "Announcements" && (
        <div className="space-y-6">
          {showForm && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">New Announcement</h2>
                <button onClick={() => setShowForm(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Announcement title..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                  <textarea rows={4} value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Write your announcement..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                    <div className="space-y-2">
                      {[
                        { value: "all", label: "All Users" },
                        { value: "department", label: "Specific Department" },
                        { value: "role", label: "Specific Role" },
                      ].map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input type="radio" name="audienceType" value={opt.value} checked={formAudienceType === opt.value} onChange={() => setFormAudienceType(opt.value)} className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                    {formAudienceType === "department" && (
                      <select value={formAudience} onChange={(e) => setFormAudience(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="engineering">Engineering</option>
                        <option value="sales">Sales</option>
                        <option value="marketing">Marketing</option>
                        <option value="hr">HR</option>
                        <option value="finance">Finance</option>
                      </select>
                    )}
                    {formAudienceType === "role" && (
                      <select value={formAudience} onChange={(e) => setFormAudience(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Schedule</label>
                      <div className="flex gap-3">
                        <button onClick={() => setFormSchedule("now")} className={cn("flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors", formSchedule === "now" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-300 text-gray-700 hover:bg-gray-50")}>
                          Send Now
                        </button>
                        <button onClick={() => setFormSchedule("later")} className={cn("flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors", formSchedule === "later" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-300 text-gray-700 hover:bg-gray-50")}>
                          Schedule for Later
                        </button>
                      </div>
                      {formSchedule === "later" && (
                        <input type="datetime-local" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select value={formPriority} onChange={(e) => setFormPriority(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="Normal">Normal</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleSaveAsDraft}
                  disabled={saving || !formTitle.trim() || !formBody.trim()}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save as Draft"}
                </button>
                <button
                  onClick={handleSendAnnouncement}
                  disabled={saving || !formTitle.trim() || !formBody.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {saving ? "Sending..." : "Send Announcement"}
                </button>
              </div>
            </div>
          )}

          {/* Edit announcement modal */}
          {editingId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Edit Announcement</h2>
                  <button onClick={() => setEditingId(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                    <textarea rows={4} value={editBody} onChange={(e) => setEditBody(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setEditingId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={() => handleEditAnnouncement(editingId)}
                    disabled={saving || !editTitle.trim() || !editBody.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">{announcement.title}</h3>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", statusColors[announcement.status])}>
                        {statusIcons[announcement.status]}
                        {announcement.status}
                      </span>
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", priorityColors[announcement.priority])}>
                        {announcement.priority === "Urgent" && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {announcement.priority}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">{announcement.body}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {announcement.targetAudience}
                      </span>
                      {announcement.sentDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Sent {announcement.sentDate}
                        </span>
                      )}
                      {announcement.scheduledDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Scheduled {announcement.scheduledDate}
                        </span>
                      )}
                      {announcement.viewCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {announcement.viewCount.toLocaleString()} views
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(announcement)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "Templates" && (
        <div className="space-y-3">
          {/* Template edit modal */}
          {editingTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Edit Template</h2>
                  <button onClick={() => setEditingTemplate(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input type="text" value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preview Text</label>
                    <textarea rows={3} value={templatePreview} onChange={(e) => setTemplatePreview(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setEditingTemplate(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                  >
                    Save Template
                  </button>
                </div>
              </div>
            </div>
          )}

          {templates.map((template) => (
            <div key={template.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{template.name}</h3>
                    <p className="mt-0.5 text-xs text-gray-500">{template.description}</p>
                    <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-3">
                      <p className="text-xs text-gray-500 font-medium mb-1">Preview</p>
                      <p className="text-sm text-gray-700 italic">{template.preview}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openTemplateEdit(template)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0 ml-4"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "Settings" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-semibold text-gray-900">Default Channels</h3>
            </div>
            <div className="space-y-3">
              {channels.map((channel, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{channel.label}</p>
                    <p className="text-xs text-gray-500">{channel.description}</p>
                  </div>
                  <button
                    onClick={() => toggleChannel(idx)}
                    className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", channel.enabled ? "bg-indigo-600" : "bg-gray-300")}
                  >
                    <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform", channel.enabled ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Quiet Hours</h3>
            <p className="text-sm text-gray-500 mb-3">Suppress non-urgent notifications during specified hours</p>
            <div className="flex items-center gap-3 max-w-md">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input type="time" value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <span className="text-sm text-gray-500 mt-5">to</span>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input type="time" value={quietTo} onChange={(e) => setQuietTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Email Digest Settings</h3>
            <div className="space-y-3 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Digest Frequency</label>
                <select value={digestFrequency} onChange={(e) => setDigestFrequency(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="immediate">Immediate (no digest)</option>
                  <option value="daily">Daily Digest</option>
                  <option value="weekly">Weekly Digest</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Digest Send Time</label>
                <input type="time" value={digestTime} onChange={(e) => setDigestTime(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
