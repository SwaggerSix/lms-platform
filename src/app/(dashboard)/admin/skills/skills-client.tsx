"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Code,
  Users,
  Briefcase,
  MessageCircle,
  Layers,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";
import { ResultLimitNotice } from "@/components/ui/result-limit-notice";

export interface Skill {
  id: string;
  name: string;
  category: "Technical" | "Soft Skills" | "Business";
  description: string;
  coursesCount: number;
  usersCount: number;
  avgProficiency: number;
  parentId?: string;
  tags: string[];
}

export interface SkillsClientProps {
  skills: Skill[];
  totalSkills?: number;
}

const categories = ["All", "Technical", "Soft Skills", "Business"] as const;

const categoryIcons: Record<string, React.ReactNode> = {
  Technical: <Code className="h-3.5 w-3.5" />,
  "Soft Skills": <MessageCircle className="h-3.5 w-3.5" />,
  Business: <Briefcase className="h-3.5 w-3.5" />,
};

const categoryColors: Record<string, string> = {
  Technical: "bg-blue-100 text-blue-700",
  "Soft Skills": "bg-emerald-100 text-emerald-700",
  Business: "bg-amber-100 text-amber-700",
};

export default function SkillsClient({ skills: initialSkills, totalSkills }: SkillsClientProps) {
  const toast = useToast();
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [newSkill, setNewSkill] = useState({
    name: "",
    category: "Technical" as Skill["category"],
    description: "",
    parentId: "",
    tagsText: "",
  });

  const filteredSkills = skills.filter((skill) => {
    const matchesCategory = activeCategory === "All" || skill.category === activeCategory;
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const parentSkills = filteredSkills.filter((s) => !s.parentId);
  const getChildren = (parentId: string) => filteredSkills.filter((s) => s.parentId === parentId);

  const parseTags = (text: string): string[] =>
    text
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const handleAddSkill = async () => {
    if (!newSkill.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSkill.name,
          category: newSkill.category,
          description: newSkill.description,
          parent_id: newSkill.parentId || null,
          tags: parseTags(newSkill.tagsText),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to add skill");
        return;
      }
      const created = await res.json();
      setSkills((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          category: created.category || "Technical",
          description: created.description || "",
          coursesCount: 0,
          usersCount: 0,
          avgProficiency: 0,
          parentId: created.parent_id || undefined,
          tags: created.tags ?? [],
        },
      ]);
      setNewSkill({ name: "", category: "Technical", description: "", parentId: "", tagsText: "" });
      setShowAddModal(false);
    } catch {
      toast.error("Failed to add skill");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSkill = async () => {
    if (!editingSkill) return;
    setSaving(true);
    try {
      const res = await fetch("/api/skills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSkill.id,
          name: editingSkill.name,
          category: editingSkill.category,
          description: editingSkill.description,
          tags: editingSkill.tags ?? [],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to update skill");
        return;
      }
      const updated = await res.json();
      setSkills((prev) =>
        prev.map((s) =>
          s.id === updated.id
            ? { ...s, name: updated.name, category: updated.category || s.category, description: updated.description || s.description, tags: updated.tags ?? s.tags }
            : s
        )
      );
      setEditingSkill(null);
    } catch {
      toast.error("Failed to update skill");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!confirm("Are you sure you want to delete this skill?")) return;
    try {
      const res = await fetch(`/api/skills?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to delete skill");
        return;
      }
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error("Failed to delete skill");
    }
  };

  const categoryBadge = (category: Skill["category"]) => (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", categoryColors[category])}>
      {categoryIcons[category]}
      {category}
    </span>
  );

  const proficiencyBar = (value: number) => (
    <div className="h-2 w-full rounded-full bg-gray-200">
      <div
        className={cn("h-2 rounded-full transition-all", value >= 70 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500")}
        style={{ width: `${value}%` }}
      />
    </div>
  );

  const rowActions = (skill: Skill) => (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => setEditingSkill(skill)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600 transition-colors" title="Edit skill">
        <Edit2 className="h-4 w-4" />
        <span className="sr-only">Edit {skill.name}</span>
      </button>
      <button onClick={() => handleDeleteSkill(skill.id)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors" title="Delete skill">
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete {skill.name}</span>
      </button>
    </div>
  );

  const columns: DataTableColumn<Skill>[] = [
    {
      key: "name",
      header: "Skill Name",
      sortValue: (s) => s.name,
      render: (skill) => (
        <div>
          <p className="font-medium text-gray-900">{skill.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{skill.description}</p>
          {skill.tags && skill.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {skill.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortValue: (s) => s.category,
      render: (skill) => categoryBadge(skill.category),
    },
    {
      key: "courses",
      header: "Courses",
      className: "text-center",
      sortValue: (s) => s.coursesCount,
      render: (skill) => <span className="text-sm text-gray-700">{skill.coursesCount}</span>,
    },
    {
      key: "users",
      header: "Users",
      className: "text-center",
      sortValue: (s) => s.usersCount,
      render: (skill) => <span className="text-sm text-gray-700">{skill.usersCount}</span>,
    },
    {
      key: "avgProficiency",
      header: "Avg Prof.",
      className: "text-center",
      sortValue: (s) => s.avgProficiency,
      render: (skill) => <span className="text-sm font-medium text-gray-900">{skill.avgProficiency}%</span>,
    },
    {
      key: "proficiency",
      header: "Proficiency",
      className: "w-40",
      render: (skill) => proficiencyBar(skill.avgProficiency),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-20 text-right",
      render: (skill) => rowActions(skill),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skills Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your organization&apos;s skills taxonomy and competency framework</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Add Skill
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                activeCategory === cat ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <ResultLimitNotice shown={skills.length} total={totalSkills ?? skills.length} noun="skills" className="mb-3" />

      <DataTable
        columns={columns}
        rows={parentSkills}
        rowKey={(skill) => skill.id}
        ariaLabel="Skills"
        isExpandable={(skill) => getChildren(skill.id).length > 0}
        renderExpanded={(skill) => (
          <div className="space-y-2">
            {getChildren(skill.id).map((child) => (
              <div key={child.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-100 bg-white px-4 py-3">
                <Layers className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">{child.name}</p>
                  <p className="text-xs text-gray-500">{child.description}</p>
                </div>
                {categoryBadge(child.category)}
                <span className="text-xs text-gray-500">
                  {child.coursesCount} courses · {child.usersCount} users
                </span>
                <div className="flex w-44 items-center gap-2">
                  {proficiencyBar(child.avgProficiency)}
                  <span className="text-xs font-medium text-gray-900">{child.avgProficiency}%</span>
                </div>
                {rowActions(child)}
              </div>
            ))}
          </div>
        )}
        emptyState={
          skills.length === 0
            ? {
                icon: <Layers className="h-10 w-10" aria-hidden="true" />,
                title: "No skills yet",
                description: "Create your first skill to start building your competency framework.",
                action: (
                  <Button onClick={() => setShowAddModal(true)}>
                    <Plus className="h-4 w-4" />
                    Add Skill
                  </Button>
                ),
              }
            : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(["Technical", "Soft Skills", "Business"] as const).map((cat) => {
          const catSkills = skills.filter((s) => s.category === cat);
          const avgProf = catSkills.length > 0 ? Math.round(catSkills.reduce((sum, s) => sum + s.avgProficiency, 0) / catSkills.length) : 0;
          return (
            <div key={cat} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-lg p-2", cat === "Technical" ? "bg-blue-100" : cat === "Soft Skills" ? "bg-emerald-100" : "bg-amber-100")}>
                  {cat === "Technical" ? <Code className="h-5 w-5 text-blue-600" /> : cat === "Soft Skills" ? <Users className="h-5 w-5 text-emerald-600" /> : <Briefcase className="h-5 w-5 text-amber-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{cat}</p>
                  <p className="text-xs text-gray-500">{catSkills.length} skills</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Avg Proficiency</span>
                  <span className="font-medium text-gray-900">{avgProf}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div className={cn("h-2 rounded-full", cat === "Technical" ? "bg-blue-500" : cat === "Soft Skills" ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${avgProf}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editingSkill && (
        <Modal
          isOpen
          onClose={() => setEditingSkill(null)}
          title="Edit Skill"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setEditingSkill(null)}>Cancel</Button>
              <Button disabled={saving} onClick={handleEditSkill}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skill Name</label>
                <input type="text" value={editingSkill.name} onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={editingSkill.category} onChange={(e) => setEditingSkill({ ...editingSkill, category: e.target.value as Skill["category"] })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                  <option value="Technical">Technical</option>
                  <option value="Soft Skills">Soft Skills</option>
                  <option value="Business">Business</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={editingSkill.description} onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mapping Tags</label>
                <input type="text" value={(editingSkill.tags ?? []).join(", ")} onChange={(e) => setEditingSkill({ ...editingSkill, tags: parseTags(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" placeholder="comma-separated, e.g. frontend, leadership, compliance" />
                <p className="mt-1 text-xs text-gray-500">Tags used to map and group this skill.</p>
              </div>
            </div>
        </Modal>
      )}

      {showAddModal && (
        <Modal
          isOpen
          onClose={() => setShowAddModal(false)}
          title="Add New Skill"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button disabled={saving} onClick={handleAddSkill}>
                {saving ? "Adding..." : "Add Skill"}
              </Button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skill Name</label>
                <input type="text" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" placeholder="e.g., TypeScript" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={newSkill.category} onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value as Skill["category"] })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                  <option value="Technical">Technical</option>
                  <option value="Soft Skills">Soft Skills</option>
                  <option value="Business">Business</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={newSkill.description} onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" placeholder="Describe this skill..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Skill (optional)</label>
                <select value={newSkill.parentId} onChange={(e) => setNewSkill({ ...newSkill, parentId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                  <option value="">None (top-level skill)</option>
                  {skills.filter((s) => !s.parentId).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mapping Tags</label>
                <input type="text" value={newSkill.tagsText} onChange={(e) => setNewSkill({ ...newSkill, tagsText: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" placeholder="comma-separated, e.g. frontend, leadership, compliance" />
                <p className="mt-1 text-xs text-gray-500">Tags used to map and group this skill.</p>
              </div>
            </div>
        </Modal>
      )}
    </div>
  );
}
