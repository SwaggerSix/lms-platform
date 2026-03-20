"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Eye,
  User,
  Calendar,
  ChevronRight,
  Plus,
  Search,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────

interface Observation {
  id: string;
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
  overall_score: number | null;
  created_at: string;
  template: { id: string; name: string; category: string | null } | null;
  observer?: { id: string; first_name: string; last_name: string } | null;
  subject?: { id: string; first_name: string; last_name: string } | null;
}

interface Template {
  id: string;
  name: string;
  category: string | null;
}

interface Props {
  asObserver: Observation[];
  asSubject: Observation[];
  templates: Template[];
  canObserve: boolean;
  userId: string;
}

// ─── Component ──────────────────────────────────────────────────

export default function MyObservationsClient({ asObserver, asSubject, templates, canObserve, userId }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"observer" | "subject">(asObserver.length > 0 ? "observer" : "subject");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create observation form state
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<{ id: string; name: string } | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");

  const observations = tab === "observer" ? asObserver : asSubject;

  const formatDate = (d: string | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
    in_progress: { bg: "bg-blue-100", text: "text-blue-600", label: "In Progress" },
    completed: { bg: "bg-green-100", text: "text-green-600", label: "Completed" },
    signed_off: { bg: "bg-purple-100", text: "text-purple-600", label: "Signed Off" },
  };

  const handleSearchSubjects = async (query: string) => {
    setSubjectSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults((data.users || []).filter((u: any) => u.id !== userId));
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !selectedSubject) {
      setError("Please select a template and subject");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selectedTemplate,
          subject_id: selectedSubject.id,
          scheduled_at: scheduledAt || undefined,
          location: location || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create observation");
      }

      const data = await res.json();
      router.push(`/learn/observations/${data.observation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Observations</h1>
          <p className="mt-1 text-sm text-gray-500">View and manage your observation checklists</p>
        </div>
        {canObserve && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Observation
          </button>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Schedule New Observation</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Template *</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 outline-none"
              >
                <option value="">Select template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.category ? `(${t.category})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subject *</label>
              {selectedSubject ? (
                <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="flex-1">{selectedSubject.name}</span>
                  <button
                    onClick={() => setSelectedSubject(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={subjectSearch}
                    onChange={(e) => handleSearchSubjects(e.target.value)}
                    placeholder="Search for a user..."
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 outline-none"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                      {searchResults.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setSelectedSubject({ id: u.id, name: `${u.first_name} ${u.last_name}` });
                            setSubjectSearch("");
                            setSearchResults([]);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <User className="h-3.5 w-3.5 text-gray-400" />
                          {u.first_name} {u.last_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Date</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Building A, Floor 2"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Observation
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab("observer")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "observer" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          As Observer ({asObserver.length})
        </button>
        <button
          onClick={() => setTab("subject")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "subject" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <User className="h-3.5 w-3.5" />
          As Subject ({asSubject.length})
        </button>
      </div>

      {/* Observation list */}
      {observations.length > 0 ? (
        <div className="space-y-3">
          {observations.map((obs) => {
            const status = statusConfig[obs.status] || statusConfig.draft;
            const otherPerson = tab === "observer" ? obs.subject : obs.observer;

            return (
              <Link
                key={obs.id}
                href={`/learn/observations/${obs.id}`}
                className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md hover:border-gray-300 transition-all"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <ClipboardCheck className="h-5 w-5 text-blue-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {obs.template?.name || "Observation"}
                    </h3>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status.bg, status.text)}>
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    {otherPerson && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {tab === "observer" ? "Subject" : "Observer"}: {otherPerson.first_name} {otherPerson.last_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(obs.completed_at || obs.scheduled_at || obs.created_at)}
                    </span>
                    {obs.overall_score !== null && (
                      <span className={cn(
                        "font-medium",
                        obs.overall_score >= 80 ? "text-green-600" : obs.overall_score >= 60 ? "text-yellow-600" : "text-red-600"
                      )}>
                        Score: {obs.overall_score}%
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <ClipboardCheck className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-sm font-semibold text-gray-700">
            {tab === "observer" ? "No observations conducted" : "No observations of you"}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {tab === "observer"
              ? "Start a new observation to evaluate someone"
              : "You'll see observations here when someone evaluates you"}
          </p>
        </div>
      )}
    </div>
  );
}
