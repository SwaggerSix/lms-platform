"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronLeft, Users, Mail } from "lucide-react";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";
import { MemberManager } from "@/components/tenants/member-manager";
import { BrandingEditor } from "@/components/tenants/branding-editor";
import { FeatureToggles } from "@/components/tenants/feature-toggles";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TenantDetailProps {
  tenant: any;
  members: any[];
  courses: any[];
  invitations: any[];
  allCourses: any[];
  allUsers: any[];
}

type Tab = "overview" | "members" | "courses" | "branding" | "features" | "settings";

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
    { key: "features", label: "Features" },
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

  const courseColumns: DataTableColumn<any>[] = [
    {
      key: "course",
      header: "Course",
      sortValue: (tc) => tc.course?.title ?? "",
      render: (tc) => (
        <span className="text-sm font-medium text-gray-900">{tc.course?.title}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (tc) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${tc.course?.status === "published" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
          {tc.course?.status}
        </span>
      ),
    },
    {
      key: "featured",
      header: "Featured",
      render: (tc) => (
        <span className="text-sm text-gray-700">{tc.is_featured ? "Yes" : "No"}</span>
      ),
    },
    {
      key: "price",
      header: "Custom Price",
      render: (tc) => (
        <span className="text-sm text-gray-700">{tc.custom_price ? `$${tc.custom_price}` : "--"}</span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      render: (tc) => (
        <button
          onClick={() => handleRemoveCourse(tc.course?.id)}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Remove
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/tenants" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold"
            style={{ backgroundColor: tenantData.primary_color || "#91C53C" }}
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
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v as Tab)} className="mb-6">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Members", value: members.length, icon: Users },
                { label: "Courses", value: coursesList.length, icon: BookOpen },
                { label: "Invitations", value: invitations.filter((i) => !i.accepted_at).length, icon: Mail },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary-600" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                        <p className="text-sm text-gray-500">{stat.label}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                {members.length === 0 && <p className="text-sm text-gray-500">No members yet</p>}
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
                      <span className={`text-xs font-medium ${val ? "text-green-600" : "text-gray-500"}`}>
                        {val ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No features configured</p>
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
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
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
              >
                Assign
              </button>
            </div>
          </div>

          {/* Assigned Courses */}
          <DataTable
            columns={courseColumns}
            rows={coursesList}
            rowKey={(tc) => tc.id}
            ariaLabel="Assigned courses"
            emptyState={{
              icon: <BookOpen className="h-10 w-10" aria-hidden="true" />,
              title: "No courses assigned",
              description: "Assign a course above to make it available to this tenant",
            }}
          />
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
            primaryColor: tenantData.primary_color || "#91C53C",
            secondaryColor: tenantData.secondary_color || "#F0A800",
            loginBg: (tenantData.branding as any)?.login_bg || "",
            heroText: (tenantData.branding as any)?.hero_text || "",
            footerText: (tenantData.branding as any)?.footer_text || "",
            customCss: (tenantData.branding as any)?.custom_css || "",
          }}
        />
      )}

      {/* Features Tab */}
      {activeTab === "features" && <FeatureToggles tenantId={tenantData.id} />}

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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={settings.slug}
                  onChange={(e) => setSettings({ ...settings, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={settings.plan}
                  onChange={(e) => setSettings({ ...settings, plan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Courses</label>
                <input
                  type="number"
                  value={settings.max_courses}
                  onChange={(e) => setSettings({ ...settings, max_courses: e.target.value })}
                  placeholder="Plan default"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
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
