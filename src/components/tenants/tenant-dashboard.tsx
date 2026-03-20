"use client";

import { useState, useEffect } from "react";

interface TenantDashboardProps {
  tenantId: string;
}

interface TenantStats {
  name: string;
  slug: string;
  plan: string;
  status: string;
  primary_color: string;
  member_count: number;
  course_count: number;
  max_users: number | null;
  max_courses: number | null;
  created_at: string;
  features: Record<string, boolean>;
}

const PLAN_LIMITS: Record<string, { maxUsers: number; maxCourses: number }> = {
  free: { maxUsers: 10, maxCourses: 3 },
  starter: { maxUsers: 50, maxCourses: 20 },
  professional: { maxUsers: 500, maxCourses: 100 },
  enterprise: { maxUsers: 9999, maxCourses: 9999 },
};

export function TenantDashboard({ tenantId }: TenantDashboardProps) {
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [tenantRes, membersRes, coursesRes] = await Promise.all([
          fetch(`/api/tenants/${tenantId}`),
          fetch(`/api/tenants/${tenantId}/members`),
          fetch(`/api/tenants/${tenantId}/courses`),
        ]);

        const tenantData = await tenantRes.json();
        const membersData = await membersRes.json();
        const coursesData = await coursesRes.json();

        if (tenantRes.ok) setStats(tenantData.tenant);
        if (membersRes.ok) setMembers(membersData.members || []);
        if (coursesRes.ok) setCourses(coursesData.courses || []);
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-gray-500">
        Failed to load tenant data.
      </div>
    );
  }

  const planLimits = PLAN_LIMITS[stats.plan] || PLAN_LIMITS.starter;
  const maxUsers = stats.max_users ?? planLimits.maxUsers;
  const maxCourses = stats.max_courses ?? planLimits.maxCourses;
  const userUsage = maxUsers > 0 ? Math.round((stats.member_count / maxUsers) * 100) : 0;
  const courseUsage = maxCourses > 0 ? Math.round((stats.course_count / maxCourses) * 100) : 0;

  const roleBreakdown = members.reduce(
    (acc: Record<string, number>, m: any) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const featuredCourses = courses.filter((c: any) => c.is_featured);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold"
          style={{ backgroundColor: stats.primary_color || "#4f46e5" }}
        >
          {stats.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{stats.name} Dashboard</h1>
          <p className="text-sm text-gray-500">{stats.slug}.lms-platform.com</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Members",
            value: stats.member_count,
            sub: `of ${maxUsers === 9999 ? "Unlimited" : maxUsers}`,
            icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
            color: "indigo",
          },
          {
            label: "Courses",
            value: stats.course_count,
            sub: `of ${maxCourses === 9999 ? "Unlimited" : maxCourses}`,
            icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
            color: "blue",
          },
          {
            label: "Plan",
            value: stats.plan.charAt(0).toUpperCase() + stats.plan.slice(1),
            sub: stats.status,
            icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
            color: "green",
          },
          {
            label: "Featured",
            value: featuredCourses.length,
            sub: "courses",
            icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
            color: "amber",
          },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">{card.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg bg-${card.color}-50 flex items-center justify-center`}>
                <svg className={`w-5 h-5 text-${card.color}-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Usage Bars & Breakdown */}
      <div className="grid grid-cols-2 gap-6">
        {/* Usage */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h3 className="text-sm font-medium text-gray-900">Resource Usage</h3>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-gray-600">Users</span>
              <span className="text-sm font-medium text-gray-900">
                {stats.member_count} / {maxUsers === 9999 ? "Unlimited" : maxUsers}
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(userUsage, 100)}%`,
                  backgroundColor: userUsage > 90 ? "#ef4444" : userUsage > 70 ? "#f59e0b" : "#4f46e5",
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-gray-600">Courses</span>
              <span className="text-sm font-medium text-gray-900">
                {stats.course_count} / {maxCourses === 9999 ? "Unlimited" : maxCourses}
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(courseUsage, 100)}%`,
                  backgroundColor: courseUsage > 90 ? "#ef4444" : courseUsage > 70 ? "#f59e0b" : "#4f46e5",
                }}
              />
            </div>
          </div>
        </div>

        {/* Role Breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Member Roles</h3>
          <div className="space-y-3">
            {Object.entries(roleBreakdown).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      role === "owner" ? "bg-purple-500" : role === "admin" ? "bg-blue-500" : "bg-gray-400"
                    }`}
                  />
                  <span className="text-sm text-gray-700 capitalize">{role}s</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{count as number}</span>
              </div>
            ))}
            {Object.keys(roleBreakdown).length === 0 && (
              <p className="text-sm text-gray-400">No members yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Courses */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Assigned Courses</h3>
        {courses.length === 0 ? (
          <p className="text-sm text-gray-400">No courses assigned to this tenant.</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {courses.slice(0, 6).map((tc: any) => (
              <div
                key={tc.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow"
              >
                <div
                  className="h-20"
                  style={{
                    background: `linear-gradient(135deg, ${stats.primary_color || "#4f46e5"}, ${stats.primary_color || "#4f46e5"}88)`,
                  }}
                >
                  {tc.is_featured && (
                    <div className="flex justify-end p-2">
                      <span className="px-1.5 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-medium rounded">
                        Featured
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 truncate">{tc.course?.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${tc.course?.status === "published" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                      {tc.course?.status}
                    </span>
                    {tc.custom_price != null && (
                      <span className="text-xs font-medium text-gray-600">${tc.custom_price}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
