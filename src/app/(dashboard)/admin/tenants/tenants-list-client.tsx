"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: string;
  status: string;
  primary_color: string;
  member_count: number;
  course_count: number;
  created_at: string;
  owner?: { id: string; first_name: string; last_name: string; email: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trial: "bg-amber-100 text-amber-800",
  suspended: "bg-red-100 text-red-800",
};

const PLAN_STYLES: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  starter: "bg-blue-100 text-blue-700",
  professional: "bg-primary-100 text-primary-700",
  enterprise: "bg-purple-100 text-purple-700",
};

export default function TenantsListClient({ tenants }: { tenants: Tenant[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = tenants.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Portals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage multi-tenant portals across the platform
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/tenants/new">
            <Plus className="w-4 h-4" />
            Create Tenant
          </Link>
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Tenants", value: tenants.length, color: "bg-primary-50 text-primary-700" },
          { label: "Active", value: tenants.filter((t) => t.status === "active").length, color: "bg-green-50 text-green-700" },
          { label: "Trial", value: tenants.filter((t) => t.status === "trial").length, color: "bg-amber-50 text-amber-700" },
          { label: "Suspended", value: tenants.filter((t) => t.status === "suspended").length, color: "bg-red-50 text-red-700" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color.split(" ")[1]}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(t) => t.id}
        ariaLabel="Tenant portals"
        emptyState={
          tenants.length === 0
            ? {
                icon: <Building2 className="h-10 w-10" aria-hidden="true" />,
                title: "No tenants yet",
                description: "Create your first tenant portal to get started.",
                action: (
                  <Button asChild>
                    <Link href="/admin/tenants/new">
                      <Plus className="w-4 h-4" />
                      Create Tenant
                    </Link>
                  </Button>
                ),
              }
            : undefined
        }
      />
    </div>
  );
}

const columns: DataTableColumn<Tenant>[] = [
  {
    key: "tenant",
    header: "Tenant",
    sortValue: (t) => t.name,
    render: (tenant) => (
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: tenant.primary_color || "#91C53C" }}
        >
          {tenant.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
          <p className="text-xs text-gray-500">{tenant.slug}.lms-platform.com</p>
        </div>
      </div>
    ),
  },
  {
    key: "plan",
    header: "Plan",
    sortValue: (t) => t.plan,
    render: (tenant) => (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${PLAN_STYLES[tenant.plan] || PLAN_STYLES.starter}`}>
        {tenant.plan}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortValue: (t) => t.status,
    render: (tenant) => (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_STYLES[tenant.status] || STATUS_STYLES.active}`}>
        {tenant.status}
      </span>
    ),
  },
  {
    key: "members",
    header: "Members",
    sortValue: (t) => t.member_count,
    render: (tenant) => <span className="text-sm text-gray-700">{tenant.member_count}</span>,
  },
  {
    key: "courses",
    header: "Courses",
    sortValue: (t) => t.course_count,
    render: (tenant) => <span className="text-sm text-gray-700">{tenant.course_count}</span>,
  },
  {
    key: "owner",
    header: "Owner",
    sortValue: (t) => (t.owner ? `${t.owner.first_name} ${t.owner.last_name}` : null),
    render: (tenant) =>
      tenant.owner ? (
        <p className="text-sm text-gray-700">
          {tenant.owner.first_name} {tenant.owner.last_name}
        </p>
      ) : (
        <span className="text-sm text-gray-500">--</span>
      ),
  },
  {
    key: "actions",
    header: <span className="sr-only">Actions</span>,
    className: "text-right",
    render: (tenant) => (
      <Link
        href={`/admin/tenants/${tenant.id}`}
        className="text-sm text-primary-600 hover:text-primary-800 font-medium"
      >
        Manage
        <span className="sr-only">, {tenant.name}</span>
      </Link>
    ),
  },
];
