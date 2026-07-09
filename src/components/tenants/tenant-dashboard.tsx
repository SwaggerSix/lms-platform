"use client";

import { useState, useEffect } from "react";
import { Users, BookOpen, BadgeCheck, Star } from "lucide-react";

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
          style={{ backgroundColor: stats.primary_color || "#91C53C" }}
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
            icon: Users,
            color: "primary",
          },
          {
            label: "Courses",
            value: stats.course_count,
            sub: `of ${maxCourses === 9999 ? "Unlimited" : maxCourses}`,
            icon: BookOpen,
            color: "blue",
          },
          {
            label: "Plan",
            value: stats.plan.charAt(0).toUpperCase() + stats.plan.slice(1),
            sub: stats.status,
            icon: BadgeCheck,
            color: "green",
          },
          {
            label: "Featured",
            value: featuredCourses.length,
            sub: "courses",
            icon: Star,
            color: "amber",
          },
        ].map((card) => {
          const CardIcon = card.icon;
          return (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">{card.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg bg-${card.color}-50 flex items-center justify-center`}>
                <CardIcon className={`w-5 h-5 text-${card.color}-600`} strokeWidth={1.5} />
              </div>
            </div>
          </div>
          );
        })}
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
                  backgroundColor: userUsage > 90 ? "#ef4444" : userUsage > 70 ? "#f59e0b" : "#91C53C",
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
                  backgroundColor: courseUsage > 90 ? "#ef4444" : courseUsage > 70 ? "#f59e0b" : "#91C53C",
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
                    background: `linear-gradient(135deg, ${stats.primary_color || "#91C53C"}, ${stats.primary_color || "#91C53C"}88)`,
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
