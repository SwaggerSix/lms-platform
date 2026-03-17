'use client';

import { cn } from '@/utils/cn';
import { formatNumber, formatPercent } from '@/utils/format';
import {
  Users,
  BookOpen,
  GraduationCap,
  TrendingUp,
  Award,
  ShieldCheck,
  Plus,
  UserPlus,
  BarChart3,
  ClipboardCheck,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  UserCheck,
  FileText,
} from 'lucide-react';

export interface DashboardData {
  totalUsers: number;
  activeCourses: number;
  enrollmentsThisMonth: number;
  completionRate: number;
  avgScore: number;
  complianceRate: number;
  topCourses: { name: string; completionRate: number }[];
  recentActivity: { id: string; action: string; user: string; target: string; time: string; type: string }[];
}

const quickActions = [
  { label: 'Create Course', icon: Plus, href: '/admin/courses/new', color: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  { label: 'Add User', icon: UserPlus, href: '/admin/users', color: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300' },
  { label: 'View Reports', icon: BarChart3, href: '/admin/reports', color: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300' },
  { label: 'Manage Compliance', icon: ClipboardCheck, href: '/admin/compliance', color: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300' },
];

const activityIcons: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  enrolled: { icon: GraduationCap, color: 'text-indigo-600 bg-indigo-50' },
  completed: { icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  added: { icon: UserCheck, color: 'text-blue-600 bg-blue-50' },
  scored: { icon: Award, color: 'text-amber-600 bg-amber-50' },
  submitted: { icon: FileText, color: 'text-purple-600 bg-purple-50' },
};

export default function DashboardClient({ data }: { data: DashboardData }) {
  const platformStats = [
    { label: 'Total Users', value: data.totalUsers, change: 12.5, trend: 'up' as const, icon: Users, color: 'bg-blue-500' },
    { label: 'Active Courses', value: data.activeCourses, change: 8.3, trend: 'up' as const, icon: BookOpen, color: 'bg-indigo-500' },
    { label: 'Enrollments This Month', value: data.enrollmentsThisMonth, change: 23.1, trend: 'up' as const, icon: GraduationCap, color: 'bg-purple-500' },
    { label: 'Completion Rate', value: data.completionRate, change: 2.4, trend: 'up' as const, icon: TrendingUp, color: 'bg-green-500', isPercent: true },
    { label: 'Avg Score', value: data.avgScore, change: -1.2, trend: 'down' as const, icon: Award, color: 'bg-amber-500', isPercent: true },
    { label: 'Compliance Rate', value: data.complianceRate, change: 1.8, trend: 'up' as const, icon: ShieldCheck, color: 'bg-emerald-500', isPercent: true },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Platform overview and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          {quickActions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors',
                action.color
              )}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </a>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {platformStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-white', stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-500">{stat.label}</p>
                <p className="mt-0.5 text-xl font-bold text-gray-900">
                  {stat.isPercent ? formatPercent(stat.value) : formatNumber(stat.value)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs">
              {stat.trend === 'up' ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
              )}
              <span className={stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(stat.change)}%
              </span>
              <span className="text-gray-400">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Course Completion Rates */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Top Course Completion Rates</h3>
          <p className="mt-1 text-xs text-gray-500">Top performing courses by completion</p>
          <div className="mt-6 space-y-4">
            {data.topCourses.map((course) => (
              <div key={course.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-gray-700 pr-2">{course.name}</span>
                  <span className="font-semibold text-gray-900">{course.completionRate}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all',
                      course.completionRate >= 90
                        ? 'bg-green-500'
                        : course.completionRate >= 75
                          ? 'bg-indigo-500'
                          : 'bg-amber-500'
                    )}
                    style={{ width: `${course.completionRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
            <p className="mt-0.5 text-xs text-gray-500">Latest platform events</p>
          </div>
          <div className="divide-y divide-gray-50">
            {data.recentActivity.map((activity) => {
              const iconData = activityIcons[activity.type] || activityIcons.enrolled;
              const Icon = iconData.icon;
              return (
                <div key={activity.id} className="flex items-center gap-4 px-6 py-3.5">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', iconData.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">{activity.user}</span>{' '}
                      {activity.action}{' '}
                      <span className="font-medium text-indigo-600">{activity.target}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    {activity.time}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
