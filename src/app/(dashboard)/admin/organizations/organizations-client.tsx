'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import {
  Building2,
  ChevronRight,
  ChevronDown,
  Plus,
  Users,
  Edit,
  Trash2,
  User,
  Briefcase,
  FolderTree,
  X,
  Loader2,
} from 'lucide-react';

export type OrgNode = {
  id: string;
  name: string;
  type: 'company' | 'department' | 'team' | 'location';
  memberCount: number;
  manager: string;
  children?: OrgNode[];
};

export interface OrganizationsClientProps {
  orgTree: OrgNode;
}

const typeIcon: Record<string, typeof Building2> = {
  company: Building2,
  department: Briefcase,
  team: Users,
  location: Building2,
};

const typeColor: Record<string, string> = {
  company: 'bg-indigo-100 text-indigo-700',
  department: 'bg-blue-100 text-blue-700',
  team: 'bg-green-100 text-green-700',
  location: 'bg-orange-100 text-orange-700',
};

interface OrgFormData {
  name: string;
  description: string;
  parent_id: string;
}

const emptyForm: OrgFormData = { name: '', description: '', parent_id: '' };

function collectAllNodes(node: OrgNode): OrgNode[] {
  const result: OrgNode[] = [node];
  if (node.children) {
    for (const child of node.children) {
      result.push(...collectAllNodes(child));
    }
  }
  return result;
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: OrgNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: OrgNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const Icon = typeIcon[node.type] || Building2;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors',
          selectedId === node.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-200"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', typeColor[node.type] || 'bg-gray-100 text-gray-700')}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className={cn('text-sm font-medium', selectedId === node.id ? 'text-indigo-700' : 'text-gray-700')}>
          {node.name}
        </span>
        <span className="ml-auto text-xs text-gray-400">{node.memberCount} members</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrganizationsClient({ orgTree: initialOrgTree }: OrganizationsClientProps) {
  const [orgTree, setOrgTree] = useState(initialOrgTree);
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [formData, setFormData] = useState<OrgFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const allNodes = collectAllNodes(orgTree);

  const openCreateModal = () => {
    setEditingNode(null);
    setFormData({ ...emptyForm, parent_id: selectedNode?.id || '' });
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (node: OrgNode) => {
    setEditingNode(node);
    setFormData({ name: node.name, description: '', parent_id: '' });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingNode(null);
    setFormData(emptyForm);
    setError(null);
  };

  const updateNodeInTree = (tree: OrgNode, id: string, updates: Partial<OrgNode>): OrgNode => {
    if (tree.id === id) return { ...tree, ...updates };
    return {
      ...tree,
      children: tree.children?.map((child) => updateNodeInTree(child, id, updates)),
    };
  };

  const removeNodeFromTree = (tree: OrgNode, id: string): OrgNode => {
    return {
      ...tree,
      children: tree.children
        ?.filter((child) => child.id !== id)
        .map((child) => removeNodeFromTree(child, id)),
    };
  };

  const addChildToTree = (tree: OrgNode, parentId: string, newChild: OrgNode): OrgNode => {
    if (tree.id === parentId) {
      return { ...tree, children: [...(tree.children || []), newChild] };
    }
    return {
      ...tree,
      children: tree.children?.map((child) => addChildToTree(child, parentId, newChild)),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingNode) {
        const res = await fetch('/api/organizations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingNode.id, name: formData.name, description: formData.description }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update organization');
        }
        setOrgTree((prev) => updateNodeInTree(prev, editingNode.id, { name: formData.name }));
        if (selectedNode?.id === editingNode.id) {
          setSelectedNode((prev) => prev ? { ...prev, name: formData.name } : null);
        }
      } else {
        const res = await fetch('/api/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create organization');
        }
        const created = await res.json();
        const newNode: OrgNode = {
          id: created.id,
          name: created.name || formData.name,
          type: 'team',
          memberCount: 0,
          manager: 'Unassigned',
          children: [],
        };
        if (formData.parent_id) {
          setOrgTree((prev) => addChildToTree(prev, formData.parent_id, newNode));
        }
      }
      closeModal();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete organization');
      }
      setOrgTree((prev) => removeNodeFromTree(prev, id));
      if (selectedNode?.id === id) setSelectedNode(null);
      setDeleteConfirmId(null);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
          <p className="mt-1 text-sm text-gray-500">Manage organizational hierarchy</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Organization
        </button>
      </div>

      {/* Global error */}
      {error && !modalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Tree View */}
        <div className="lg:col-span-3 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Org Hierarchy</h3>
            </div>
          </div>
          <div className="p-3">
            <TreeNode node={orgTree} depth={0} selectedId={selectedNode?.id ?? null} onSelect={setSelectedNode} />
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Details</h3>
          </div>
          {selectedNode ? (
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', typeColor[selectedNode.type] || 'bg-gray-100 text-gray-700')}>
                  {(() => { const I = typeIcon[selectedNode.type] || Building2; return <I className="h-6 w-6" />; })()}
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{selectedNode.name}</h4>
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', typeColor[selectedNode.type] || 'bg-gray-100 text-gray-700')}>
                    {selectedNode.type}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-500">Members</span>
                  <span className="text-sm font-semibold text-gray-900">{selectedNode.memberCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-500">Manager</span>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
                      {selectedNode.manager.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{selectedNode.manager}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-500">Type</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">{selectedNode.type}</span>
                </div>
                {selectedNode.children && (
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                    <span className="text-sm text-gray-500">Sub-units</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedNode.children.length}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {deleteConfirmId === selectedNode.id ? (
                  <>
                    <button
                      onClick={() => handleDelete(selectedNode.id)}
                      disabled={deleteLoading}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm Delete'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => openEditModal(selectedNode)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(selectedNode.id)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <Building2 className="h-6 w-6 text-gray-400" />
              </div>
              <p className="mt-3 text-sm text-gray-500">Select an organization to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingNode ? 'Edit Organization' : 'Add Organization'}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Organization name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Describe the organization"
                />
              </div>
              {!editingNode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parent Organization</label>
                  <select
                    value={formData.parent_id}
                    onChange={(e) => setFormData((f) => ({ ...f, parent_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">None (top level)</option>
                    {allNodes.map((n) => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingNode ? 'Save Changes' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
