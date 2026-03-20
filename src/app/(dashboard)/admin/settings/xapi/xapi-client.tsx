"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Database,
  Search,
  Plug,
  Play,
  ChevronDown,
  ChevronRight,
  Activity,
  Server,
  Filter,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LRSConfig {
  id: string;
  name: string;
  endpoint_url: string;
  auth_type: "basic" | "oauth";
  username: string | null;
  has_password: boolean;
  has_token: boolean;
  is_active: boolean;
  sync_direction: "push" | "pull" | "both";
  last_sync_at: string | null;
  created_at: string;
}

interface XAPIStatement {
  id: string;
  statement_id: string;
  actor_id: string;
  verb: string;
  verb_display: string | null;
  object_type: string;
  object_id: string;
  object_name: string | null;
  result_score_scaled: number | null;
  result_score_raw: number | null;
  result_success: boolean | null;
  result_completion: boolean | null;
  result_duration: string | null;
  context_course_id: string | null;
  stored_at: string;
  timestamp: string;
}

interface XAPIClientProps {
  initialConfigs: LRSConfig[];
  initialStatements: XAPIStatement[];
  totalStatements: number;
}

type Tab = "connections" | "explorer";
type View = "list" | "add" | "edit";

// ─── Component ───────────────────────────────────────────────────────────────

export default function XAPIClient({
  initialConfigs,
  initialStatements,
  totalStatements,
}: XAPIClientProps) {
  const toast = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("connections");

  // Connection management state
  const [configs, setConfigs] = useState<LRSConfig[]>(initialConfigs);
  const [view, setView] = useState<View>("list");
  const [editingConfig, setEditingConfig] = useState<LRSConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Form state
  const [formName, setFormName] = useState("");
  const [formEndpoint, setFormEndpoint] = useState("");
  const [formAuthType, setFormAuthType] = useState<"basic" | "oauth">("basic");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formToken, setFormToken] = useState("");
  const [formSyncDirection, setFormSyncDirection] = useState<"push" | "pull" | "both">("push");
  const [formIsActive, setFormIsActive] = useState(true);

  // Statement explorer state
  const [statements, setStatements] = useState<XAPIStatement[]>(initialStatements);
  const [statementsTotal, setStatementsTotal] = useState(totalStatements);
  const [statementsPage, setStatementsPage] = useState(1);
  const [statementsLoading, setStatementsLoading] = useState(false);
  const [expandedStatement, setExpandedStatement] = useState<string | null>(null);

  // Filters
  const [filterVerb, setFilterVerb] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [filterSince, setFilterSince] = useState("");
  const [filterUntil, setFilterUntil] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // ─── Form Helpers ────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setFormName("");
    setFormEndpoint("");
    setFormAuthType("basic");
    setFormUsername("");
    setFormPassword("");
    setFormToken("");
    setFormSyncDirection("push");
    setFormIsActive(true);
  }, []);

  const populateForm = useCallback((config: LRSConfig) => {
    setFormName(config.name);
    setFormEndpoint(config.endpoint_url || "");
    setFormAuthType(config.auth_type);
    setFormUsername(config.username || "");
    setFormPassword("");
    setFormToken("");
    setFormSyncDirection(config.sync_direction);
    setFormIsActive(config.is_active);
  }, []);

  // ─── Connection CRUD ────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!formName.trim() || !formEndpoint.trim()) {
      toast.error("Name and endpoint URL are required");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formName,
        endpoint_url: formEndpoint,
        auth_type: formAuthType,
        username: formAuthType === "basic" ? formUsername : null,
        sync_direction: formSyncDirection,
        is_active: formIsActive,
      };

      if (formAuthType === "basic" && formPassword) {
        payload.password = formPassword;
      }
      if (formAuthType === "oauth" && formToken) {
        payload.token = formToken;
      }

      if (view === "edit" && editingConfig) {
        const res = await fetch(`/api/admin/lrs/${editingConfig.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
        const { configuration } = await res.json();
        setConfigs((prev) =>
          prev.map((c) => (c.id === editingConfig.id ? { ...c, ...configuration, has_password: !!formPassword || c.has_password, has_token: !!formToken || c.has_token } : c))
        );
        toast.success("LRS configuration updated");
      } else {
        const res = await fetch("/api/admin/lrs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create");
        const { configuration } = await res.json();
        setConfigs((prev) => [configuration, ...prev]);
        toast.success("LRS configuration created");
      }

      setView("list");
      setEditingConfig(null);
      resetForm();
    } catch {
      toast.error("Failed to save LRS configuration");
    } finally {
      setSaving(false);
    }
  }, [formName, formEndpoint, formAuthType, formUsername, formPassword, formToken, formSyncDirection, formIsActive, view, editingConfig, resetForm, toast]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this LRS connection?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/lrs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setConfigs((prev) => prev.filter((c) => c.id !== id));
      toast.success("LRS configuration deleted");
    } catch {
      toast.error("Failed to delete LRS configuration");
    } finally {
      setDeleting(null);
    }
  }, [toast]);

  const handleTest = useCallback(async (id: string) => {
    setTesting(id);
    setTestResults((prev) => ({ ...prev, [id]: { success: false, message: "Testing..." } }));
    try {
      const res = await fetch(`/api/admin/lrs/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const result = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: result.success, message: result.message },
      }));
      if (result.success) {
        toast.success("Connection test passed");
      } else {
        toast.error(`Connection test failed: ${result.message}`);
      }
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message: "Connection test failed" },
      }));
      toast.error("Connection test failed");
    } finally {
      setTesting(null);
    }
  }, [toast]);

  const handleSync = useCallback(async (id: string, action: "push" | "pull") => {
    setSyncing(id);
    try {
      const res = await fetch(`/api/admin/lrs/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        // Update last_sync_at
        setConfigs((prev) =>
          prev.map((c) => (c.id === id ? { ...c, last_sync_at: new Date().toISOString() } : c))
        );
      } else {
        toast.error(result.error || "Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(null);
    }
  }, [toast]);

  // ─── Statement Explorer ──────────────────────────────────────────────────

  const fetchStatements = useCallback(async (page: number = 1) => {
    setStatementsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "25");
      if (filterVerb) params.set("verb", filterVerb);
      if (filterActivity) params.set("activity", filterActivity);
      if (filterSince) params.set("since", filterSince);
      if (filterUntil) params.set("until", filterUntil);

      const res = await fetch(`/api/xapi/statements?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setStatements(data.statements || []);
      setStatementsTotal(data.total || 0);
      setStatementsPage(page);
    } catch {
      toast.error("Failed to fetch statements");
    } finally {
      setStatementsLoading(false);
    }
  }, [filterVerb, filterActivity, filterSince, filterUntil, toast]);

  const clearFilters = useCallback(() => {
    setFilterVerb("");
    setFilterActivity("");
    setFilterSince("");
    setFilterUntil("");
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  const verbLabel = (verb: string) => {
    const parts = verb.split("/");
    return parts[parts.length - 1] || verb;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">xAPI / Learning Record Store</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage external LRS connections, sync learning data, and explore xAPI statements.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab("connections")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "connections"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Server className="w-4 h-4" />
              LRS Connections
            </span>
          </button>
          <button
            onClick={() => setActiveTab("explorer")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "explorer"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Statement Explorer
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {statementsTotal}
              </span>
            </span>
          </button>
        </nav>
      </div>

      {/* ─── Connections Tab ──────────────────────────────────────────────── */}
      {activeTab === "connections" && (
        <>
          {view === "list" && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">External LRS Endpoints</h2>
                <button
                  onClick={() => {
                    resetForm();
                    setView("add");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Connection
                </button>
              </div>

              {configs.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No LRS connections configured</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Connect an external Learning Record Store to sync xAPI statements.
                  </p>
                  <button
                    onClick={() => {
                      resetForm();
                      setView("add");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Connection
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      className="bg-white rounded-xl border border-gray-200 p-5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-base font-semibold text-gray-900">{config.name}</h3>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                config.is_active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {config.is_active ? "Active" : "Inactive"}
                            </span>
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-600">
                              {config.auth_type === "basic" ? "Basic Auth" : "OAuth"}
                            </span>
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-50 text-purple-600 capitalize">
                              {config.sync_direction}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 font-mono">{config.endpoint_url}</p>
                          {config.last_sync_at && (
                            <p className="text-xs text-gray-400 mt-1">
                              Last synced: {formatDate(config.last_sync_at)}
                            </p>
                          )}
                          {testResults[config.id] && (
                            <p
                              className={`text-xs mt-2 ${
                                testResults[config.id].success ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {testResults[config.id].success ? "Connected" : "Failed"}: {testResults[config.id].message}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleTest(config.id)}
                            disabled={testing === config.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                          >
                            {testing === config.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Plug className="w-3.5 h-3.5" />
                            )}
                            Test
                          </button>
                          {["push", "both"].includes(config.sync_direction) && (
                            <button
                              onClick={() => handleSync(config.id, "push")}
                              disabled={syncing === config.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                              {syncing === config.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                              Push
                            </button>
                          )}
                          {["pull", "both"].includes(config.sync_direction) && (
                            <button
                              onClick={() => handleSync(config.id, "pull")}
                              disabled={syncing === config.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                            >
                              {syncing === config.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              Pull
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingConfig(config);
                              populateForm(config);
                              setView("edit");
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(config.id)}
                            disabled={deleting === config.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            {deleting === config.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Add / Edit Form */}
          {(view === "add" || view === "edit") && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-800">
                  {view === "add" ? "Add LRS Connection" : "Edit LRS Connection"}
                </h2>
                <button
                  onClick={() => {
                    setView("list");
                    setEditingConfig(null);
                    resetForm();
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-5 max-w-2xl">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Connection Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Company LRS, Watershed, Learning Locker"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Endpoint URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endpoint URL *
                  </label>
                  <input
                    type="url"
                    value={formEndpoint}
                    onChange={(e) => setFormEndpoint(e.target.value)}
                    placeholder="https://lrs.example.com/xapi"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Auth Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Authentication Type
                  </label>
                  <select
                    value={formAuthType}
                    onChange={(e) => setFormAuthType(e.target.value as "basic" | "oauth")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="basic">Basic Authentication</option>
                    <option value="oauth">OAuth / Bearer Token</option>
                  </select>
                </div>

                {/* Basic Auth Fields */}
                {formAuthType === "basic" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Username / Key
                      </label>
                      <input
                        type="text"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password / Secret
                        {view === "edit" && editingConfig?.has_password && (
                          <span className="text-xs text-gray-400 ml-1">(leave blank to keep)</span>
                        )}
                      </label>
                      <input
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* OAuth Token */}
                {formAuthType === "oauth" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bearer Token
                      {view === "edit" && editingConfig?.has_token && (
                        <span className="text-xs text-gray-400 ml-1">(leave blank to keep)</span>
                      )}
                    </label>
                    <input
                      type="password"
                      value={formToken}
                      onChange={(e) => setFormToken(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Sync Direction */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sync Direction
                  </label>
                  <select
                    value={formSyncDirection}
                    onChange={(e) => setFormSyncDirection(e.target.value as "push" | "pull" | "both")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="push">Push (send statements to LRS)</option>
                    <option value="pull">Pull (import statements from LRS)</option>
                    <option value="both">Both (bidirectional sync)</option>
                  </select>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      formIsActive ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                        formIsActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-700">
                    {formIsActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Save Button */}
                <div className="pt-4 flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {view === "add" ? "Create Connection" : "Save Changes"}
                  </button>
                  <button
                    onClick={() => {
                      setView("list");
                      setEditingConfig(null);
                      resetForm();
                    }}
                    className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Statement Explorer Tab ───────────────────────────────────────── */}
      {activeTab === "explorer" && (
        <>
          {/* Filters */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-800">xAPI Statements</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filters
                  {(filterVerb || filterActivity || filterSince || filterUntil) && (
                    <span className="bg-blue-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                      !
                    </span>
                  )}
                </button>
                <button
                  onClick={() => fetchStatements(1)}
                  disabled={statementsLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  {statementsLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Refresh
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Verb</label>
                    <input
                      type="text"
                      value={filterVerb}
                      onChange={(e) => setFilterVerb(e.target.value)}
                      placeholder="e.g., http://adlnet.gov/..."
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Activity</label>
                    <input
                      type="text"
                      value={filterActivity}
                      onChange={(e) => setFilterActivity(e.target.value)}
                      placeholder="Activity ID"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Since</label>
                    <input
                      type="datetime-local"
                      value={filterSince}
                      onChange={(e) => setFilterSince(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Until</label>
                    <input
                      type="datetime-local"
                      value={filterUntil}
                      onChange={(e) => setFilterUntil(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => fetchStatements(1)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                  >
                    <Search className="w-3 h-3" />
                    Apply Filters
                  </button>
                  <button
                    onClick={() => {
                      clearFilters();
                      fetchStatements(1);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Statements List */}
          {statements.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No statements found</h3>
              <p className="text-sm text-gray-500">
                xAPI statements will appear here as learners interact with the platform.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Verb
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Object
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Result
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {statements.map((stmt) => (
                      <>
                        <tr
                          key={stmt.id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() =>
                            setExpandedStatement(
                              expandedStatement === stmt.id ? null : stmt.id
                            )
                          }
                        >
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                              {stmt.verb_display || verbLabel(stmt.verb)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 truncate max-w-xs">
                              {stmt.object_name || stmt.object_id}
                            </div>
                            <div className="text-xs text-gray-400 truncate max-w-xs">
                              {stmt.object_id}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-xs">
                              {stmt.result_score_raw !== null && (
                                <span className="text-gray-700">
                                  Score: {stmt.result_score_raw}
                                </span>
                              )}
                              {stmt.result_success !== null && (
                                <span
                                  className={
                                    stmt.result_success
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  {stmt.result_success ? "Passed" : "Failed"}
                                </span>
                              )}
                              {stmt.result_completion !== null && (
                                <span className="text-blue-600">
                                  {stmt.result_completion ? "Complete" : "Incomplete"}
                                </span>
                              )}
                              {stmt.result_duration && (
                                <span className="text-gray-500">{stmt.result_duration}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {formatDate(stmt.timestamp)}
                          </td>
                          <td className="px-4 py-3">
                            {expandedStatement === stmt.id ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </td>
                        </tr>
                        {expandedStatement === stmt.id && (
                          <tr key={`${stmt.id}-detail`}>
                            <td colSpan={5} className="px-4 py-3 bg-gray-50">
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <span className="font-medium text-gray-600">Statement ID:</span>{" "}
                                  <span className="text-gray-500 font-mono">
                                    {stmt.statement_id}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-600">Actor ID:</span>{" "}
                                  <span className="text-gray-500 font-mono">{stmt.actor_id}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-600">Verb URI:</span>{" "}
                                  <span className="text-gray-500 font-mono">{stmt.verb}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-600">Object Type:</span>{" "}
                                  <span className="text-gray-500">{stmt.object_type}</span>
                                </div>
                                {stmt.context_course_id && (
                                  <div>
                                    <span className="font-medium text-gray-600">Course ID:</span>{" "}
                                    <span className="text-gray-500 font-mono">
                                      {stmt.context_course_id}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <span className="font-medium text-gray-600">Stored at:</span>{" "}
                                  <span className="text-gray-500">
                                    {formatDate(stmt.stored_at)}
                                  </span>
                                </div>
                                {stmt.result_score_scaled !== null && (
                                  <div>
                                    <span className="font-medium text-gray-600">
                                      Scaled Score:
                                    </span>{" "}
                                    <span className="text-gray-500">
                                      {stmt.result_score_scaled}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {statementsTotal > 25 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-500">
                    Showing {(statementsPage - 1) * 25 + 1} -{" "}
                    {Math.min(statementsPage * 25, statementsTotal)} of {statementsTotal}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchStatements(statementsPage - 1)}
                      disabled={statementsPage <= 1 || statementsLoading}
                      className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchStatements(statementsPage + 1)}
                      disabled={
                        statementsPage * 25 >= statementsTotal || statementsLoading
                      }
                      className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
