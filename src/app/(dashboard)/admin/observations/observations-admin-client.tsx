"use client";

import { useState } from "react";
import {
  Plus,
  ClipboardCheck,
  Calendar,
  Search,
  Filter,
  Eye,
  Trash2,
  Edit,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  LayoutGrid,
  List,
} from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  items: Array<{ id: string; label: string; type: string; required: boolean; weight: number }>;
  passing_score: number | null;
  is_active: boolean;
  created_at: string;
}

interface Observation {
  id: string;
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
  overall_score: number | null;
  created_at: string;
  template: { id: string; name: string; category: string | null } | null;
  observer: { id: string; first_name: string; last_name: string } | null;
  subject: { id: string; first_name: string; last_name: string } | null;
}

interface Props {
  initialTemplates: Template[];
  initialObservations: Observation[];
}

// ─── Component ──────────────────────────────────────────────────

export default function ObservationsAdminClient({ initialTemplates, initialObservations }: Props) {
  const [tab, setTab] = useState<"templates" | "observations">("templates");
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [observations] = useState<Observation[]>(initialObservations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredTemplates = templates.filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredObservations = observations.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        o.template?.name?.toLowerCase().includes(s) ||
        o.observer?.first_name?.toLowerCase().includes(s) ||
        o.observer?.last_name?.toLowerCase().includes(s) ||
        o.subject?.first_name?.toLowerCase().includes(s) ||
        o.subject?.last_name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/observations/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete template");
    }
  };

  const handleToggleTemplate = async (id: string, active: boolean) => {
    const res = await fetch(`/api/observations/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: active }),
    });
    if (res.ok) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active: active } : t))
      );
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const statusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      draft: { bg: "bg-gray-100", text: "text-gray-600" },
      in_progress: { bg: "bg-blue-100", text: "text-blue-600" },
      completed: { bg: "bg-green-100", text: "text-green-600" },
      signed_off: { bg: "bg-purple-100", text: "text-purple-600" },
    };
    const c = config[status] || config.draft;
    return (
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", c.bg, c.text)}>
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Observation Checklists</h1>
          <p className="mt-1 text-sm text-gray-500">Manage templates and track observation assessments</p>
        </div>
        <Link
          href="/admin/observations/templates/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Template
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
              <p className="text-xs text-gray-500">Templates</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {observations.filter((o) => o.status === "draft" || o.status === "in_progress").length}
              </p>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {observations.filter((o) => o.status === "completed" || o.status === "signed_off").length}
              </p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{observations.length}</p>
              <p className="text-xs text-gray-500">Total Observations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("templates")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === "templates" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Templates
          </button>
          <button
            onClick={() => setTab("observations")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === "observations" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <List className="h-3.5 w-3.5" />
            Observations
          </button>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-xs focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none w-48"
            />
          </div>
          {tab === "observations" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-gray-200 py-1.5 px-2 text-xs focus:border-blue-400 outline-none"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="signed_off">Signed Off</option>
            </select>
          )}
        </div>
      </div>

      {/* Templates tab */}
      {tab === "templates" && (
        <div>
          {filteredTemplates.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={cn(
                    "rounded-lg border bg-white p-4 transition-all hover:shadow-md",
                    template.is_active ? "border-gray-200" : "border-gray-100 opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{template.name}</h3>
                      {template.category && (
                        <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {template.category}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      template.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {template.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {template.description && (
                    <p className="mt-2 text-xs text-gray-500 line-clamp-2">{template.description}</p>
                  )}

                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <ClipboardCheck className="h-3 w-3" />
                      {template.items?.length || 0} items
                    </span>
                    {template.passing_score && (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Pass: {template.passing_score}%
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(template.created_at)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1 border-t border-gray-100 pt-3">
                    <button
                      onClick={() => handleToggleTemplate(template.id, !template.is_active)}
                      className={cn(
                        "rounded px-2 py-1 text-xs font-medium transition-colors",
                        template.is_active
                          ? "text-gray-500 hover:bg-gray-100"
                          : "text-green-600 hover:bg-green-50"
                      )}
                    >
                      {template.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
              <ClipboardCheck className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-3 text-sm font-semibold text-gray-700">No templates yet</h3>
              <p className="mt-1 text-sm text-gray-500">Create your first observation checklist template</p>
              <Link
                href="/admin/observations/templates/new"
                className="mt-4 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Create Template
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Observations tab */}
      {tab === "observations" && (
        <div>
          {filteredObservations.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Template</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Observer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredObservations.map((obs) => (
                    <tr key={obs.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {obs.template?.name || "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {obs.observer ? `${obs.observer.first_name} ${obs.observer.last_name}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {obs.subject ? `${obs.subject.first_name} ${obs.subject.last_name}` : "-"}
                      </td>
                      <td className="px-4 py-3">{statusBadge(obs.status)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {obs.overall_score !== null ? `${obs.overall_score}%` : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDate(obs.completed_at || obs.scheduled_at || obs.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/learn/observations/${obs.id}`}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-3 text-sm font-semibold text-gray-700">No observations found</h3>
              <p className="mt-1 text-sm text-gray-500">Observations will appear here once created</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
