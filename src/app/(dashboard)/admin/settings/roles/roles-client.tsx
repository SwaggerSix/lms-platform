"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  PERMISSION_CATALOG,
  CUSTOM_ROLE_BASE_ROLES,
  defaultPermissionsForRole,
} from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/auth/roles";

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  base_role: string;
  organization_id: string | null;
  permissions: string[];
  is_active: boolean;
}

type BaseRole = (typeof CUSTOM_ROLE_BASE_ROLES)[number];

const EMPTY_FORM = {
  id: null as string | null,
  name: "",
  description: "",
  base_role: "instructor" as BaseRole,
  permissions: [] as string[],
  is_active: true,
};

export default function RolesClient() {
  const toast = useToast();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/custom-roles");
      const data = await res.json();
      if (res.ok) setRoles(data.customRoles ?? []);
    } catch {
      /* leave empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Permissions a role may grant are constrained to its base role's defaults.
  const allowedForBase = useMemo(
    () => new Set(defaultPermissionsForRole(form.base_role)),
    [form.base_role]
  );

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (role: CustomRole) => {
    setForm({
      id: role.id,
      name: role.name,
      description: role.description ?? "",
      base_role: (CUSTOM_ROLE_BASE_ROLES.includes(role.base_role as BaseRole)
        ? role.base_role
        : "instructor") as BaseRole,
      permissions: role.permissions ?? [],
      is_active: role.is_active,
    });
    setModalOpen(true);
  };

  // Changing the base role prunes any now-disallowed selections.
  const changeBaseRole = (base_role: BaseRole) => {
    const allowed = new Set(defaultPermissionsForRole(base_role));
    setForm((f) => ({
      ...f,
      base_role,
      permissions: f.permissions.filter((p) => allowed.has(p)),
    }));
  };

  const togglePermission = (key: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        base_role: form.base_role,
        permissions: form.permissions,
        is_active: form.is_active,
      };
      const res = form.id
        ? await fetch(`/api/admin/custom-roles/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/custom-roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save role");
        return;
      }
      toast.success(form.id ? "Role updated" : "Role created");
      setModalOpen(false);
      load();
    } catch {
      toast.error("Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: CustomRole) => {
    if (!confirm(`Delete the custom role "${role.name}"? Users with this role revert to their base role.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/custom-roles/${role.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to delete role");
        return;
      }
      toast.success("Role deleted");
      load();
    } catch {
      toast.error("Failed to delete role");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Roles &amp; Permissions</h1>
          <p className="mt-1 text-sm text-gray-600">
            Custom roles layer a granular permission set on top of a built-in base role.
            A custom role can only narrow what its base role is allowed to do.
          </p>
        </div>
        <Button onClick={openCreate}>New role</Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading…</p>
        ) : roles.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            No custom roles yet. Create one to delegate a narrower slice of a base role.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Base role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{role.name}</div>
                    {role.description && (
                      <div className="text-xs text-gray-500">{role.description}</div>
                    )}
                  </TableCell>
                  <TableCell>{ROLE_LABELS[role.base_role as keyof typeof ROLE_LABELS] ?? role.base_role}</TableCell>
                  <TableCell>{role.permissions?.length ?? 0}</TableCell>
                  <TableCell>
                    <span
                      className={
                        role.is_active
                          ? "rounded bg-green-100 px-2 py-0.5 text-xs text-green-700"
                          : "rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      }
                    >
                      {role.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => remove(role)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? "Edit custom role" : "New custom role"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save role"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. Content Reviewer"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Base role</label>
              <select
                value={form.base_role}
                onChange={(e) => changeBaseRole(e.target.value as BaseRole)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {CUSTOM_ROLE_BASE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Permissions</p>
            <p className="mb-3 text-xs text-gray-500">
              Only permissions the <strong>{ROLE_LABELS[form.base_role]}</strong> base role
              already has can be granted — greyed-out items are outside that base role.
            </p>
            <div className="space-y-4">
              {PERMISSION_CATALOG.map((group) => (
                <div key={group.group}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {group.group}
                  </p>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {group.permissions.map((perm) => {
                      const allowed = allowedForBase.has(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className={
                            allowed
                              ? "flex items-start gap-2 rounded-md p-1.5 text-sm text-gray-700 hover:bg-gray-50"
                              : "flex items-start gap-2 rounded-md p-1.5 text-sm text-gray-300"
                          }
                          title={allowed ? perm.description : "Not available for this base role"}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            disabled={!allowed}
                            checked={allowed && form.permissions.includes(perm.key)}
                            onChange={() => togglePermission(perm.key)}
                          />
                          <span>
                            <span className="font-medium">{perm.label}</span>
                            <span className="block text-xs text-gray-400">{perm.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
