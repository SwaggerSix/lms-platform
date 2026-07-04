"use client";

import { useState } from "react";
import {
  User,
  Bell,
  Shield,
  Settings,
  Eye,
  EyeOff,
  Globe,
  Clock,
  LogOut,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { TwoFactorCard } from "@/components/security/two-factor-card";
import { locales, localeNames, type Locale } from "@/i18n/config";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface NotificationSetting {
  key: string;
  label: string;
  inApp: boolean;
  email: boolean;
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
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          bio,
          preferences: { ...getCurrentPreferences(), bio },
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to save personal info.");
      }
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
    locale: language,
    timezone,
    date_format: dateFormat,
    notifications: notifications.reduce((acc, n) => {
      acc[n.key] = { inApp: n.inApp, email: n.email };
      return acc;
    }, {} as Record<string, { inApp: boolean; email: boolean }>),
  });

  const saveNotifications = async () => {
    setSaving("notifications");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: getCurrentPreferences() }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to save notifications.");
      }
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
      const prefs = getCurrentPreferences();
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs, timezone }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to save preferences.");
      }

      // Sync locale cookie when language changes
      if (language !== data.language) {
        document.cookie = `lms-locale=${language};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax;secure`;
        // Reload to apply new locale
        showToast("success", "Preferences saved. Reloading...");
        setTimeout(() => window.location.reload(), 500);
        return;
      }

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
          <nav className="flex gap-6" aria-label="Settings sections">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  aria-pressed={activeTab === tab.key}
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
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600 text-2xl font-bold text-white">
                  {data.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Profile Photo</p>
                  <p className="text-xs text-gray-500">Your initials are shown while photo uploads are unavailable.</p>
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
                <Button
                  onClick={savePersonalInfo}
                  disabled={saving === "personal"}
                >
                  {saving === "personal" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
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
                          role="switch"
                          aria-checked={notif.inApp}
                          aria-label={`${notif.label} in-app notifications`}
                          className={cn("relative h-6 w-11 rounded-full transition-colors", notif.inApp ? "bg-indigo-600" : "bg-gray-200")}
                        >
                          <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", notif.inApp && "translate-x-5")} />
                        </button>
                      </div>
                      {/* Email toggle */}
                      <div className="flex justify-center">
                        <button
                          onClick={() => toggleNotification(notif.key, "email")}
                          role="switch"
                          aria-checked={notif.email}
                          aria-label={`${notif.label} email notifications`}
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
                <Button
                  onClick={saveNotifications}
                  disabled={saving === "notifications"}
                >
                  {saving === "notifications" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Preferences
                </Button>
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
                  <Button
                    onClick={changePassword}
                    disabled={saving === "password"}
                  >
                    {saving === "password" && <Loader2 className="h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </div>
              </div>

              {/* Two-Factor Authentication */}
              <TwoFactorCard />
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
                    {locales.map((loc) => (
                      <option key={loc} value={loc}>
                        {localeNames[loc]}
                      </option>
                    ))}
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
                <Button
                  onClick={savePreferences}
                  disabled={saving === "preferences"}
                >
                  {saving === "preferences" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Preferences
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
