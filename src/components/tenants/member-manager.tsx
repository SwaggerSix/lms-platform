"use client";

import { useState } from "react";

interface Member {
  id: string;
  role: string;
  joined_at: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface MemberManagerProps {
  tenantId: string;
  initialMembers: Member[];
  invitations: Invitation[];
  allUsers: { id: string; first_name: string; last_name: string; email: string }[];
}

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  member: "bg-gray-100 text-gray-700",
};

export function MemberManager({
  tenantId,
  initialMembers,
  invitations: initialInvitations,
  allUsers,
}: MemberManagerProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [tab, setTab] = useState<"members" | "invitations">("members");
  const [addMode, setAddMode] = useState<"existing" | "invite" | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const memberUserIds = new Set(members.map((m) => m.user?.id));
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUserId, role: selectedRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers((prev) => [...prev, data.member]);
      setSelectedUserId("");
      setAddMode(null);
      showMessage("success", "Member added");
    } catch (err: any) {
      showMessage("error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInvitations((prev) => [data.invitation, ...prev]);
      setInviteEmail("");
      setAddMode(null);
      showMessage("success", "Invitation sent");
    } catch (err: any) {
      showMessage("error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this member from the tenant?")) return;
    try {
      const res = await fetch(`/api/tenants/${tenantId}/members?user_id=${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setMembers((prev) => prev.filter((m) => m.user?.id !== userId));
      showMessage("success", "Member removed");
    } catch (err: any) {
      showMessage("error", err.message);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      // Remove and re-add with new role
      await fetch(`/api/tenants/${tenantId}/members?user_id=${userId}`, { method: "DELETE" });
      const res = await fetch(`/api/tenants/${tenantId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers((prev) =>
        prev.map((m) => (m.user?.id === userId ? { ...m, role: newRole } : m))
      );
      showMessage("success", "Role updated");
    } catch (err: any) {
      showMessage("error", err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("members")}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${tab === "members" ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Members ({members.length})
          </button>
          <button
            onClick={() => setTab("invitations")}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${tab === "invitations" ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Invitations ({invitations.filter((i) => !i.accepted_at).length})
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAddMode(addMode === "existing" ? null : "existing")}
            className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Add Existing User
          </button>
          <button
            onClick={() => setAddMode(addMode === "invite" ? null : "invite")}
            className="px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Invite by Email
          </button>
        </div>
      </div>

      {/* Add Existing User Form */}
      {addMode === "existing" && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Add Existing User</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">User</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a user...</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <label className="block text-xs text-gray-500 mb-1">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <button
              onClick={handleAddMember}
              disabled={!selectedUserId || loading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* Invite Form */}
      {addMode === "invite" && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Send Invitation</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="w-36">
              <label className="block text-xs text-gray-500 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={!inviteEmail || loading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {/* Members List */}
      {tab === "members" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Platform Role</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Tenant Role</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Joined</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No members</td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
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
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 capitalize">{m.user?.role}</span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={m.role}
                        onChange={(e) => handleChangeRole(m.user?.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${ROLE_STYLES[m.role] || ROLE_STYLES.member}`}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(m.joined_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemoveMember(m.user?.id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Invitations List */}
      {tab === "invitations" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Expires</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No invitations</td>
                </tr>
              ) : (
                invitations.map((inv) => {
                  const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
                  const statusLabel = inv.accepted_at ? "Accepted" : isExpired ? "Expired" : "Pending";
                  const statusStyle = inv.accepted_at
                    ? "bg-green-100 text-green-800"
                    : isExpired
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800";
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{inv.email}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_STYLES[inv.role] || ROLE_STYLES.member}`}>
                          {inv.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "--"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
