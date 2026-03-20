"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Edit2,
  Shield,
  ShieldCheck,
  ShieldOff,
  Key,
  Copy,
  Check,
  Loader2,
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";

interface SSOProvider {
  id: string;
  name: string;
  provider_type: "saml" | "oidc";
  entity_id: string | null;
  metadata_url: string | null;
  domain: string;
  is_active: boolean;
  auto_provision_users: boolean;
  default_role: string;
  attribute_mapping: Record<string, string>;
  scim_enabled: boolean;
  has_scim_token: boolean;
  created_at: string;
  updated_at: string;
}

interface SSOClientProps {
  initialProviders: SSOProvider[];
  supabaseProjectUrl: string;
}

const roles = [
  { value: "learner", label: "Learner" },
  { value: "instructor", label: "Instructor" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

const defaultAttributeMapping: Record<string, string> = {
  first_name: "",
  last_name: "",
  email: "",
  role: "",
  organization: "",
};

type View = "list" | "add" | "edit";

export default function SSOClient({ initialProviders, supabaseProjectUrl }: SSOClientProps) {
  const toast = useToast();
  const [providers, setProviders] = useState<SSOProvider[]>(initialProviders);
  const [view, setView] = useState<View>("list");
  const [editingProvider, setEditingProvider] = useState<SSOProvider | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"saml" | "oidc">("saml");
  const [formEntityId, setFormEntityId] = useState("");
  const [formMetadataUrl, setFormMetadataUrl] = useState("");
  const [formDomain, setFormDomain] = useState("");
  const [formAutoProvision, setFormAutoProvision] = useState(true);
  const [formDefaultRole, setFormDefaultRole] = useState("learner");
  const [formAttrMapping, setFormAttrMapping] = useState<Record<string, string>>({ ...defaultAttributeMapping });

  // SCIM state
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);
  const [newScimToken, setNewScimToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Test connection state
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormType("saml");
    setFormEntityId("");
    setFormMetadataUrl("");
    setFormDomain("");
    setFormAutoProvision(true);
    setFormDefaultRole("learner");
    setFormAttrMapping({ ...defaultAttributeMapping });
    setEditingProvider(null);
  }, []);

  const openAddForm = useCallback(() => {
    resetForm();
    setView("add");
  }, [resetForm]);

  const openEditForm = useCallback((provider: SSOProvider) => {
    setEditingProvider(provider);
    setFormName(provider.name);
    setFormType(provider.provider_type);
    setFormEntityId(provider.entity_id ?? "");
    setFormMetadataUrl(provider.metadata_url ?? "");
    setFormDomain(provider.domain);
    setFormAutoProvision(provider.auto_provision_users);
    setFormDefaultRole(provider.default_role);
    setFormAttrMapping({
      ...defaultAttributeMapping,
      ...(provider.attribute_mapping ?? {}),
    });
    setView("edit");
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload: Record<string, unknown> = {
      name: formName,
      provider_type: formType,
      entity_id: formEntityId || null,
      metadata_url: formMetadataUrl || null,
      domain: formDomain.toLowerCase().trim(),
      auto_provision_users: formAutoProvision,
      default_role: formDefaultRole,
      attribute_mapping: Object.fromEntries(
        Object.entries(formAttrMapping).filter(([, v]) => v.trim() !== "")
      ),
    };

    if (editingProvider) {
      payload.id = editingProvider.id;
    }

    try {
      const res = await fetch("/api/sso", {
        method: editingProvider ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save SSO provider");
        setSaving(false);
        return;
      }

      if (editingProvider) {
        setProviders((prev) =>
          prev.map((p) => (p.id === data.id ? { ...data, has_scim_token: p.has_scim_token } : p))
        );
        toast.success("SSO provider updated");
      } else {
        setProviders((prev) => [{ ...data, has_scim_token: false }, ...prev]);
        toast.success("SSO provider created");
      }

      resetForm();
      setView("list");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this SSO provider? This cannot be undone.")) {
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch(`/api/sso?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete provider");
        return;
      }
      setProviders((prev) => prev.filter((p) => p.id !== id));
      toast.success("SSO provider deleted");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (provider: SSOProvider) => {
    setToggling(provider.id);
    try {
      const res = await fetch("/api/sso", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: provider.id, is_active: !provider.is_active }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to toggle provider");
        return;
      }

      setProviders((prev) =>
        prev.map((p) =>
          p.id === provider.id ? { ...p, is_active: !p.is_active } : p
        )
      );
      toast.success(
        provider.is_active ? "SSO provider deactivated" : "SSO provider activated"
      );
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setToggling(null);
    }
  };

  const handleGenerateScimToken = async (providerId: string) => {
    if (
      !confirm(
        "This will generate a new SCIM token and invalidate any existing one. Continue?"
      )
    ) {
      return;
    }

    setGeneratingToken(providerId);
    setNewScimToken(null);

    try {
      const res = await fetch("/api/sso/scim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate SCIM token");
        return;
      }

      setNewScimToken(data.token);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId ? { ...p, scim_enabled: true, has_scim_token: true } : p
        )
      );
      toast.success("SCIM token generated");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setGeneratingToken(null);
    }
  };

  const handleCopyToken = async () => {
    if (!newScimToken) return;
    try {
      await navigator.clipboard.writeText(newScimToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleTestConnection = async (provider: SSOProvider) => {
    setTestingConnection(provider.id);
    try {
      // We test by verifying the metadata URL is reachable
      if (!provider.metadata_url) {
        toast.error("No metadata URL configured for this provider");
        return;
      }
      const res = await fetch(provider.metadata_url, { mode: "no-cors" });
      // no-cors won't give us the body, but it will succeed if reachable
      toast.success("Connection test passed: metadata URL is reachable");
    } catch {
      toast.error("Connection test failed: could not reach metadata URL");
    } finally {
      setTestingConnection(null);
    }
  };

  const acsUrl = supabaseProjectUrl
    ? `${supabaseProjectUrl}/auth/v1/sso/saml/acs`
    : "https://<project-ref>.supabase.co/auth/v1/sso/saml/acs";

  const spEntityId = supabaseProjectUrl
    ? `${supabaseProjectUrl}/auth/v1/sso/saml/metadata`
    : "https://<project-ref>.supabase.co/auth/v1/sso/saml/metadata";

  // ------ RENDER ------

  if (view === "add" || view === "edit") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetForm();
              setView("list");
            }}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {view === "add" ? "Add SSO Provider" : "Edit SSO Provider"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {view === "add"
                ? "Configure a new SAML 2.0 or OIDC identity provider"
                : `Editing ${editingProvider?.name}`}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* Basic Info */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Provider Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Provider Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="e.g. Okta, Azure AD, OneLogin"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Provider Type *
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as "saml" | "oidc")}
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="saml">SAML 2.0</option>
                  <option value="oidc">OIDC</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Entity ID / Issuer URL
                </label>
                <input
                  type="text"
                  value={formEntityId}
                  onChange={(e) => setFormEntityId(e.target.value)}
                  placeholder="https://idp.example.com/entity-id"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Metadata URL
                </label>
                <input
                  type="url"
                  value={formMetadataUrl}
                  onChange={(e) => setFormMetadataUrl(e.target.value)}
                  placeholder="https://idp.example.com/saml/metadata"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email Domain *
                </label>
                <input
                  type="text"
                  value={formDomain}
                  onChange={(e) => setFormDomain(e.target.value)}
                  required
                  placeholder="acme.com"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Users with this email domain will be routed to this SSO provider during login.
                </p>
              </div>
            </div>
          </div>

          {/* Provisioning */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">User Provisioning</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formAutoProvision}
                  onChange={(e) => setFormAutoProvision(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    Auto-provision users on first SSO login
                  </span>
                  <p className="text-xs text-gray-500">
                    Automatically create a user profile when someone signs in via this provider for the first time.
                  </p>
                </div>
              </label>

              <div className="max-w-xs">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Default Role
                </label>
                <select
                  value={formDefaultRole}
                  onChange={(e) => setFormDefaultRole(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Attribute Mapping */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Attribute Mapping</h2>
            <p className="mb-4 text-sm text-gray-500">
              Map SAML/OIDC assertion attributes to user profile fields. Enter the attribute name
              from your IdP for each field.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(formAttrMapping).map(([field, value]) => (
                <div key={field}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 capitalize">
                    {field.replace(/_/g, " ")}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) =>
                      setFormAttrMapping((prev) => ({
                        ...prev,
                        [field]: e.target.value,
                      }))
                    }
                    placeholder={`IdP attribute for ${field.replace(/_/g, " ")}`}
                    className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Service Provider Metadata (for admin to configure in IdP) */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-gray-900">
              Service Provider (SP) Metadata
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Provide these values to your Identity Provider administrator when configuring the SAML application.
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
                  ACS URL (Assertion Consumer Service)
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 select-all">
                    {acsUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(acsUrl)}
                    className="rounded-lg border border-gray-300 p-2 text-gray-400 hover:text-gray-600"
                    title="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
                  SP Entity ID / Audience URI
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 select-all">
                    {spEntityId}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(spEntityId)}
                    className="rounded-lg border border-gray-300 p-2 text-gray-400 hover:text-gray-600"
                    title="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {view === "add" ? "Create Provider" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setView("list");
              }}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ---- LIST VIEW ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin/settings" className="hover:text-indigo-600">
              Settings
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">SSO</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Single Sign-On</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage SAML 2.0 / OIDC identity providers and SCIM provisioning
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add Provider
        </button>
      </div>

      {/* SCIM Token Banner */}
      {newScimToken && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-800">
                SCIM Token Generated
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                Copy this token now. It will not be shown again.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-mono text-gray-800 break-all select-all">
                  {newScimToken}
                </code>
                <button
                  onClick={handleCopyToken}
                  className="shrink-0 rounded-lg border border-amber-300 bg-white p-2 text-amber-600 hover:bg-amber-100"
                  title="Copy token"
                >
                  {tokenCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <button
                onClick={() => setNewScimToken(null)}
                className="mt-2 text-xs font-medium text-amber-700 underline hover:text-amber-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provider list */}
      {providers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            No SSO providers configured
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Add a SAML 2.0 or OIDC identity provider to enable single sign-on for your
            organization.
          </p>
          <button
            onClick={openAddForm}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add SSO Provider
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              {/* Provider header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      provider.is_active
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-400"
                    )}
                  >
                    {provider.is_active ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <ShieldOff className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {provider.name}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium uppercase text-gray-600">
                        {provider.provider_type}
                      </span>
                      <span>@{provider.domain}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          provider.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {provider.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTestConnection(provider)}
                    disabled={testingConnection === provider.id}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                    title="Test connection"
                  >
                    {testingConnection === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => openEditForm(provider)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id)}
                    disabled={deleting === provider.id}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Provider details */}
              <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Entity ID
                  </p>
                  <p className="mt-1 truncate text-sm text-gray-700">
                    {provider.entity_id || "Not configured"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Default Role
                  </p>
                  <p className="mt-1 text-sm capitalize text-gray-700">
                    {provider.default_role}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Auto-Provision
                  </p>
                  <p className="mt-1 text-sm text-gray-700">
                    {provider.auto_provision_users ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>

              {/* Actions bar */}
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
                <button
                  onClick={() => handleToggleActive(provider)}
                  disabled={toggling === provider.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                    provider.is_active
                      ? "border-red-200 text-red-600 hover:bg-red-50"
                      : "border-green-200 text-green-600 hover:bg-green-50"
                  )}
                >
                  {toggling === provider.id && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {provider.is_active ? "Deactivate" : "Activate"}
                </button>

                {/* SCIM section */}
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
                  <Key className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    SCIM: {provider.scim_enabled ? "Enabled" : "Disabled"}
                  </span>
                  <button
                    onClick={() => handleGenerateScimToken(provider.id)}
                    disabled={generatingToken === provider.id}
                    className="ml-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    {generatingToken === provider.id ? (
                      <Loader2 className="inline h-3 w-3 animate-spin" />
                    ) : provider.has_scim_token ? (
                      "Regenerate Token"
                    ) : (
                      "Generate Token"
                    )}
                  </button>
                </div>

                {provider.scim_enabled && (
                  <div className="text-xs text-gray-500">
                    SCIM Endpoint:{" "}
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">
                      {supabaseProjectUrl}/auth/v1/scim/v2
                    </code>
                  </div>
                )}

                {provider.metadata_url && (
                  <a
                    href={provider.metadata_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Metadata
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SP Metadata Reference */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">
          Service Provider (SP) Metadata
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Provide these values when configuring the SAML application in your Identity Provider.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
              ACS URL (Assertion Consumer Service)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 select-all">
                {acsUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(acsUrl)}
                className="rounded-lg border border-gray-300 p-2 text-gray-400 hover:text-gray-600"
                title="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
              SP Entity ID / Audience URI
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 select-all">
                {spEntityId}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(spEntityId)}
                className="rounded-lg border border-gray-300 p-2 text-gray-400 hover:text-gray-600"
                title="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
              SP Metadata URL
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 select-all">
                {spEntityId}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(spEntityId)}
                className="rounded-lg border border-gray-300 p-2 text-gray-400 hover:text-gray-600"
                title="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
