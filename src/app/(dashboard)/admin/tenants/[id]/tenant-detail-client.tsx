"use client";

import { useState } from "react";
import Link from "next/link";
import { MemberManager } from "@/components/tenants/member-manager";
import { BrandingEditor } from "@/components/tenants/branding-editor";

interface TenantDetailProps {
  tenant: any;
  members: any[];
  courses: any[];
  invitations: any[];
  allCourses: any[];
  allUsers: any[];
}

type Tab = "overview" | "members" | "courses" | "branding" | "settings";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trial: "bg-amber-100 text-amber-800",
  suspended: "bg-red-100 text-red-800",
};

export default function TenantDetailClient({
  tenant,
  members,
  courses,
  invitations,
  allCourses,
  allUsers,
}: TenantDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [tenantData, setTenantData] = useState(tenant);
  const [coursesList, setCoursesList] = useState(courses);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Settings form state
  const [settings, setSettings] = useState({
    name: tenantData.name,
    slug: tenantData.slug,
    domain: tenantData.domain || "",
    plan: tenantData.plan,
    status: tenantData.status,
    max_users: tenantData.max_users || "",
    max_courses: tenantData.max_courses || "",
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "members", label: "Members" },
    { key: "courses", label: "Courses" },
    { key: "branding", label: "Branding" },
    { key: "settings", label: "Settings" },
  ];

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: settings.name,
        slug: settings.slug,
        plan: settings.plan,
        status: settings.status,
      };
      if (settings.domain) payload.domain = settings.domain;
      if (settings.max_users) payload.max_users = Number(settings.max_users);
      if (settings.max_courses) payload.max_courses = Number(settings.max_courses);

      const res = await fetch(`/api/tenants/${tenantData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTenantData(data.tenant);
      showMessage("success", "Settings saved successfully");
    } catch (err: any) {
      showMessage("error", err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignCourse = async (courseId: string) => {
    try {
      const res = await fetch(`/api/tenants/${tenantData.id}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoursesList((prev) => [data.course, ...prev]);
      showMessage("success", "Course assigned");
    } catch (err: any) {
      showMessage("error", err.message || "Failed to assign course");
    }
  };

  const handleRemoveCourse = async (courseId: string) => {
    try {
      const res = await fetch(`/api/tenants/${tenantData.id}/courses?course_id=${courseId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setCoursesList((prev) => prev.filter((c: any) => c.course?.id !== courseId));
      showMessage("success", "Course removed");
    } catch (err: any) {
      showMessage("error", err.message || "Failed to remove course");
    }
  };

  const assignedCourseIds = new Set(coursesList.map((c: any) => c.course?.id));
  const availableCourses = allCourses.filter((c: any) => !assignedCourseIds.has(c.id));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/tenants" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold"
            style={{ backgroundColor: tenantData.primary_color || "#4f46e5" }}
          >
            {tenantData.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tenantData.name}</h1>
            <p className="text-sm text-gray-500">{tenantData.slug}.lms-platform.com</p>
          </div>
        </div>
        <span className={`ml-4 px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_STYLES[tenantData.status] || ""}`}>
          {tenantData.status}
        </span>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Members", value: members.length, icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
                { label: "Courses", value: coursesList.length, icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
                { label: "Invitations", value: invitations.filter((i) => !i.accepted_at).length, icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-sm text-gray-500">{stat.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Members */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Recent Members</h3>
              <div className="space-y-3">
                {members.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                        {m.user?.first_name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {m.user?.first_name} {m.user?.last_name}
                        </p>
                        <p className="text-xs text-gray-500">{m.user?.email}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-gray-500 capitalize">{m.role}</span>
                  </div>
                ))}
                {members.length === 0 && <p className="text-sm text-gray-400">No members yet</p>}
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Tenant Info</h3>
              <dl className="space-y-3">
                {[
                  { label: "Plan", value: tenantData.plan },
                  { label: "Domain", value: tenantData.domain || "Not set" },
                  { label: "Owner", value: tenantData.owner ? `${tenantData.owner.first_name} ${tenantData.owner.last_name}` : "None" },
                  { label: "Created", value: new Date(tenantData.created_at).toLocaleDateString() },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <dt className="text-sm text-gray-500">{item.label}</dt>
                    <dd className="text-sm font-medium text-gray-900 capitalize">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Features</h3>
              <div className="space-y-2">
                {Object.entries(tenantData.features || {}).length > 0 ? (
                  Object.entries(tenantData.features).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 capitalize">{key.replace(/_/g, " ")}</span>
                      <span className={`text-xs font-medium ${val ? "text-green-600" : "text-gray-400"}`}>
                        {val ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No features configured</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members Tab */}
      {activeTab === "members" && (
        <MemberManager
          tenantId={tenantData.id}
          initialMembers={members}
          invitations={invitations}
          allUsers={allUsers}
        />
      )}

      {/* Courses Tab */}
      {activeTab === "courses" && (
        <div className="space-y-6">
          {/* Assign Course */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Assign Course</h3>
            <div className="flex items-center gap-3">
              <select
                id="assign-course-select"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                defaultValue=""
              >
                <option value="" disabled>Select a course to assign...</option>
                {availableCourses.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const el = document.getElementById("assign-course-select") as HTMLSelectElement;
                  if (el.value) {
                    handleAssignCourse(el.value);
                    el.value = "";
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                Assign
              </button>
            </div>
          </div>

          {/* Assigned Courses */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Course</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Featured</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Custom Price</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {coursesList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No courses assigned</td>
                  </tr>
                ) : (
                  coursesList.map((tc: any) => (
                    <tr key={tc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{tc.course?.title}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${tc.course?.status === "published" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                          {tc.course?.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{tc.is_featured ? "Yes" : "No"}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{tc.custom_price ? `$${tc.custom_price}` : "--"}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRemoveCourse(tc.course?.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Branding Tab */}
      {activeTab === "branding" && (
        <BrandingEditor
          tenantId={tenantData.id}
          initialBranding={{
            name: tenantData.name,
            logoUrl: tenantData.logo_url,
            faviconUrl: tenantData.favicon_url,
            primaryColor: tenantData.primary_color || "#4f46e5",
            secondaryColor: tenantData.secondary_color || "#7c3aed",
            loginBg: (tenantData.branding as any)?.login_bg || "",
            heroText: (tenantData.branding as any)?.hero_text || "",
            footerText: (tenantData.branding as any)?.footer_text || "",
            customCss: (tenantData.branding as any)?.custom_css || "",
          }}
        />
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            <h3 className="text-lg font-medium text-gray-900">Tenant Settings</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={settings.slug}
                  onChange={(e) => setSettings({ ...settings, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Domain</label>
              <input
                type="text"
                value={settings.domain}
                onChange={(e) => setSettings({ ...settings, domain: e.target.value })}
                placeholder="learn.company.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={settings.plan}
                  onChange={(e) => setSettings({ ...settings, plan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={settings.status}
                  onChange={(e) => setSettings({ ...settings, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Users</label>
                <input
                  type="number"
                  value={settings.max_users}
                  onChange={(e) => setSettings({ ...settings, max_users: e.target.value })}
                  placeholder="Plan default"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Courses</label>
                <input
                  type="number"
                  value={settings.max_courses}
                  onChange={(e) => setSettings({ ...settings, max_courses: e.target.value })}
                  placeholder="Plan default"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white border border-red-200 rounded-xl p-6">
            <h3 className="text-lg font-medium text-red-900 mb-2">Danger Zone</h3>
            <p className="text-sm text-gray-600 mb-4">
              Deleting a tenant will permanently remove all associated memberships, course assignments, and invitations.
            </p>
            <button
              onClick={async () => {
                if (!confirm(`Are you sure you want to delete "${tenantData.name}"? This action cannot be undone.`)) return;
                const res = await fetch(`/api/tenants/${tenantData.id}`, { method: "DELETE" });
                if (res.ok) {
                  window.location.href = "/admin/tenants";
                } else {
                  const data = await res.json();
                  showMessage("error", data.error || "Failed to delete tenant");
                }
              }}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
            >
              Delete Tenant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
