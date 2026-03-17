"use client";

import { useState } from "react";
import {
  User,
  Bell,
  Shield,
  Settings,
  Camera,
  Eye,
  EyeOff,
  Monitor,
  Moon,
  Sun,
  Globe,
  Clock,
  Smartphone,
  Laptop,
  LogOut,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface NotificationSetting {
  key: string;
  label: string;
  inApp: boolean;
  email: boolean;
}

export interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  icon: "laptop" | "mobile";
}

export interface SettingsData {
  userId: string;
  firstName: string;
  lastName: string;
  initials: string;
  email: string;
  jobTitle: string;
  organizationName: string;
  bio: string;
  language: string;
  timezone: string;
  theme: "light" | "dark" | "system";
  dateFormat: string;
}

/* ------------------------------------------------------------------ */
/*  Static Data                                                        */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: "personal" as const, label: "Personal Info", icon: User },
  { key: "notifications" as const, label: "Notifications", icon: Bell },
  { key: "security" as const, label: "Security", icon: Shield },
  { key: "preferences" as const, label: "Preferences", icon: Settings },
];

type TabKey = "personal" | "notifications" | "security" | "preferences";

const INITIAL_NOTIFICATIONS: NotificationSetting[] = [
  { key: "enrollment", label: "Enrollment Confirmations", inApp: true, email: true },
  { key: "due_dates", label: "Due Date Reminders", inApp: true, email: true },
  { key: "completions", label: "Course Completions", inApp: true, email: true },
  { key: "certificate", label: "Certificate Issued", inApp: true, email: false },
  { key: "discussions", label: "Discussion Replies", inApp: true, email: true },
  { key: "announcements", label: "Announcements", inApp: true, email: false },
  { key: "digest", label: "Weekly Digest", inApp: true, email: false },
];

const SESSIONS: Session[] = [
  { id: "s1", device: "MacBook Pro - Chrome", location: "San Francisco, CA", lastActive: "Active now", isCurrent: true, icon: "laptop" },
  { id: "s2", device: "iPhone 15 - Safari", location: "San Francisco, CA", lastActive: "2 hours ago", isCurrent: false, icon: "mobile" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SettingsClient({ data }: { data: SettingsData }) {
  const [activeTab, setActiveTab] = useState<TabKey>("personal");
  const [firstName, setFirstName] = useState(data.firstName);
  const [lastName, setLastName] = useState(data.lastName);
  const [bio, setBio] = useState(data.bio);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [language, setLanguage] = useState(data.language);
  const [timezone, setTimezone] = useState(data.timezone);
  const [theme, setTheme] = useState<"light" | "dark" | "system">(data.theme);
  const [dateFormat, setDateFormat] = useState(data.dateFormat);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const savePersonalInfo = async () => {
    setSaving("personal");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("users")
        .update({
          first_name: firstName,
          last_name: lastName,
          preferences: { ...getCurrentPreferences(), bio },
        })
        .eq("id", data.userId);
      if (error) throw error;
      showToast("success", "Personal info saved.");
    } catch (err: any) {
      showToast("error", err.message || "Failed to save personal info.");
    } finally {
      setSaving(null);
    }
  };

  const getCurrentPreferences = () => ({
    bio,
    language,
    timezone,
    theme,
    date_format: dateFormat,
    notifications: notifications.reduce((acc, n) => {
      acc[n.key] = { inApp: n.inApp, email: n.email };
      return acc;
    }, {} as Record<string, { inApp: boolean; email: boolean }>),
  });

  const saveNotifications = async () => {
    setSaving("notifications");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("users")
        .update({ preferences: getCurrentPreferences() })
        .eq("id", data.userId);
      if (error) throw error;
      showToast("success", "Notification preferences saved.");
    } catch (err: any) {
      showToast("error", err.message || "Failed to save notifications.");
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      showToast("error", "New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      showToast("error", "Password must be at least 8 characters.");
      return;
    }
    if (!currentPassword) {
      showToast("error", "Please enter your current password.");
      return;
    }
    setSaving("password");
    try {
      const supabase = createClient();
      // Verify current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: currentPassword,
      });
      if (signInError) {
        showToast("error", "Current password is incorrect.");
        setSaving(null);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("success", "Password updated.");
    } catch (err: any) {
      showToast("error", err.message || "Failed to change password.");
    } finally {
      setSaving(null);
    }
  };

  const savePreferences = async () => {
    setSaving("preferences");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("users")
        .update({ preferences: getCurrentPreferences() })
        .eq("id", data.userId);
      if (error) throw error;
      showToast("success", "Preferences saved.");
    } catch (err: any) {
      showToast("error", err.message || "Failed to save preferences.");
    } finally {
      setSaving(null);
    }
  };

  const toggleNotification = (key: string, channel: "inApp" | "email") => {
    setNotifications((prev) =>
      prev.map((n) => (n.key === key ? { ...n, [channel]: !n[channel] } : n))
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast notification */}
      {toast && (
        <div className={cn(
          "fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all",
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === "success" && <CheckCircle2 className="h-4 w-4" />}
          {toast.message}
        </div>
      )}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account preferences and security.</p>

        {/* ---- Tab Navigation ---- */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="flex gap-6">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors",
                    activeTab === tab.key ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {activeTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded bg-indigo-600" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ---- Tab Content ---- */}
        <div className="mt-6">
          {/* ======== PERSONAL INFO ======== */}
          {activeTab === "personal" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
              <p className="mt-1 text-sm text-gray-500">Update your profile details.</p>

              {/* Avatar upload area */}
              <div className="mt-6 flex items-center gap-4">
                <div className="group relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600 text-2xl font-bold text-white">
                    {data.initials}
                  </div>
                  <div className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Profile Photo</p>
                  <p className="text-xs text-gray-500">Click avatar to change. JPG, PNG or GIF. Max 2MB.</p>
                </div>
              </div>

              {/* Form fields */}
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={data.email}
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Job Title</label>
                  <input
                    type="text"
                    value={data.jobTitle}
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Department</label>
                  <input
                    type="text"
                    value={data.organizationName}
                    readOnly
                    className="w-full max-w-xs cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={savePersonalInfo}
                  disabled={saving === "personal"}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving === "personal" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* ======== NOTIFICATIONS ======== */}
          {activeTab === "notifications" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
              <p className="mt-1 text-sm text-gray-500">Choose how and when you want to be notified.</p>

              <div className="mt-6">
                {/* Header row */}
                <div className="mb-4 grid grid-cols-[1fr_60px_60px] items-center gap-4 border-b border-gray-200 pb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                  <span>Notification Type</span>
                  <span className="text-center">In-App</span>
                  <span className="text-center">Email</span>
                </div>

                <div className="divide-y divide-gray-100">
                  {notifications.map((notif) => (
                    <div key={notif.key} className="grid grid-cols-[1fr_60px_60px] items-center gap-4 py-4">
                      <span className="text-sm font-medium text-gray-900">{notif.label}</span>
                      {/* In-App toggle */}
                      <div className="flex justify-center">
                        <button
                          onClick={() => toggleNotification(notif.key, "inApp")}
                          className={cn("relative h-6 w-11 rounded-full transition-colors", notif.inApp ? "bg-indigo-600" : "bg-gray-200")}
                        >
                          <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", notif.inApp && "translate-x-5")} />
                        </button>
                      </div>
                      {/* Email toggle */}
                      <div className="flex justify-center">
                        <button
                          onClick={() => toggleNotification(notif.key, "email")}
                          className={cn("relative h-6 w-11 rounded-full transition-colors", notif.email ? "bg-indigo-600" : "bg-gray-200")}
                        >
                          <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", notif.email && "translate-x-5")} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={saveNotifications}
                  disabled={saving === "notifications"}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving === "notifications" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* ======== SECURITY ======== */}
          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Change Password */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
                <p className="mt-1 text-sm text-gray-500">Update your password regularly for security.</p>
                <div className="mt-4 max-w-sm space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    onClick={changePassword}
                    disabled={saving === "password"}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving === "password" && <Loader2 className="h-4 w-4 animate-spin" />}
                    Update Password
                  </button>
                </div>
              </div>

              {/* Active Sessions */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Active Sessions</h2>
                <p className="mt-1 text-sm text-gray-500">Manage devices where you are currently logged in.</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        <th className="pb-3 pr-4">Device</th>
                        <th className="pb-3 px-4">Location</th>
                        <th className="pb-3 px-4">Last Active</th>
                        <th className="pb-3 pl-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {SESSIONS.map((session) => (
                        <tr key={session.id} className={cn(session.isCurrent && "bg-green-50")}>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              {session.icon === "laptop" ? <Laptop className="h-4 w-4 text-gray-400" /> : <Smartphone className="h-4 w-4 text-gray-400" />}
                              <span className="text-sm font-medium text-gray-900">{session.device}</span>
                              {session.isCurrent && (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Current</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{session.location}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{session.lastActive}</td>
                          <td className="py-3 pl-4">
                            {!session.isCurrent && (
                              <button className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700">
                                <LogOut className="h-3.5 w-3.5" />
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Two-Factor Authentication */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h2>
                <p className="mt-1 text-sm text-gray-500">Add an extra layer of security to your account.</p>
                <div className="mt-4 flex items-center gap-4">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">Not enabled</span>
                  <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                    Enable 2FA
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======== PREFERENCES ======== */}
          {activeTab === "preferences" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
              <p className="mt-1 text-sm text-gray-500">Customize your learning experience.</p>

              <div className="mt-6 space-y-6">
                {/* Language */}
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Globe className="h-4 w-4" /> Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </div>

                {/* Timezone */}
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Clock className="h-4 w-4" /> Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">GMT</option>
                    <option value="Europe/Berlin">Central European Time (CET)</option>
                    <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                  </select>
                </div>

                {/* Theme */}
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Monitor className="h-4 w-4" /> Theme
                  </label>
                  <div className="mt-2 flex gap-3">
                    {[
                      { key: "light" as const, label: "Light", icon: Sun },
                      { key: "dark" as const, label: "Dark", icon: Moon },
                      { key: "system" as const, label: "System", icon: Monitor },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <label
                          key={opt.key}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors",
                            theme === opt.key
                              ? "border-indigo-600 bg-indigo-50 text-indigo-600"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50"
                          )}
                        >
                          <input
                            type="radio"
                            name="theme"
                            value={opt.key}
                            checked={theme === opt.key}
                            onChange={() => setTheme(opt.key)}
                            className="sr-only"
                          />
                          <Icon className="h-4 w-4" />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Date Format */}
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Clock className="h-4 w-4" /> Date Format
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={savePreferences}
                  disabled={saving === "preferences"}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving === "preferences" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
