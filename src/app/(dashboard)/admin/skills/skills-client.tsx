"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Code,
  Users,
  Briefcase,
  MessageCircle,
  Layers,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";

export interface Skill {
  id: string;
  name: string;
  category: "Technical" | "Soft Skills" | "Business";
  description: string;
  coursesCount: number;
  usersCount: number;
  avgProficiency: number;
  parentId?: string;
}

export interface SkillsClientProps {
  skills: Skill[];
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

export default function SkillsClient({ skills: initialSkills }: SkillsClientProps) {
  const toast = useToast();
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [newSkill, setNewSkill] = useState({
    name: "",
    category: "Technical" as Skill["category"],
    description: "",
    parentId: "",
  });

  const filteredSkills = skills.filter((skill) => {
    const matchesCategory = activeCategory === "All" || skill.category === activeCategory;
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const parentSkills = filteredSkills.filter((s) => !s.parentId);
  const getChildren = (parentId: string) => filteredSkills.filter((s) => s.parentId === parentId);

  const toggleExpand = (id: string) => {
    setExpandedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
        },
      ]);
      setNewSkill({ name: "", category: "Technical", description: "", parentId: "" });
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
            ? { ...s, name: updated.name, category: updated.category || s.category, description: updated.description || s.description }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skills Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your organization&apos;s skills taxonomy and competency framework</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Skill
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
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
            className="rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr,120px,100px,100px,100px,160px,80px] gap-4 border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">
          <div>Skill Name</div>
          <div>Category</div>
          <div className="text-center">Courses</div>
          <div className="text-center">Users</div>
          <div className="text-center">Avg Prof.</div>
          <div>Proficiency</div>
          <div className="text-right">Actions</div>
        </div>
        <div className="divide-y divide-gray-100">
          {parentSkills.map((skill) => {
            const children = getChildren(skill.id);
            const hasChildren = children.length > 0;
            const isExpanded = expandedSkills.has(skill.id);
            return (
              <div key={skill.id}>
                <div className="grid grid-cols-[1fr,120px,100px,100px,100px,160px,80px] gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    {hasChildren ? (
                      <button onClick={() => toggleExpand(skill.id)} className="text-gray-400 hover:text-gray-600">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    ) : (
                      <span className="w-4" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{skill.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{skill.description}</p>
                    </div>
                  </div>
                  <div>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", categoryColors[skill.category])}>
                      {categoryIcons[skill.category]}
                      {skill.category}
                    </span>
                  </div>
                  <div className="text-center text-sm text-gray-700">{skill.coursesCount}</div>
                  <div className="text-center text-sm text-gray-700">{skill.usersCount}</div>
                  <div className="text-center text-sm font-medium text-gray-900">{skill.avgProficiency}%</div>
                  <div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className={cn("h-2 rounded-full transition-all", skill.avgProficiency >= 70 ? "bg-emerald-500" : skill.avgProficiency >= 50 ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: `${skill.avgProficiency}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditingSkill(skill)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-colors">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteSkill(skill.id)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {hasChildren && isExpanded && children.map((child) => (
                  <div key={child.id} className="grid grid-cols-[1fr,120px,100px,100px,100px,160px,80px] gap-4 px-6 py-3 items-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2 pl-10">
                      <Layers className="h-3.5 w-3.5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{child.name}</p>
                        <p className="text-xs text-gray-500">{child.description}</p>
                      </div>
                    </div>
                    <div>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", categoryColors[child.category])}>
                        {categoryIcons[child.category]}
                        {child.category}
                      </span>
                    </div>
                    <div className="text-center text-sm text-gray-700">{child.coursesCount}</div>
                    <div className="text-center text-sm text-gray-700">{child.usersCount}</div>
                    <div className="text-center text-sm font-medium text-gray-900">{child.avgProficiency}%</div>
                    <div>
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div
                          className={cn("h-2 rounded-full", child.avgProficiency >= 70 ? "bg-emerald-500" : child.avgProficiency >= 50 ? "bg-amber-500" : "bg-red-500")}
                          style={{ width: `${child.avgProficiency}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditingSkill(child)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-colors">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteSkill(child.id)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Edit Skill</h2>
              <button onClick={() => setEditingSkill(null)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skill Name</label>
                <input type="text" value={editingSkill.name} onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={editingSkill.category} onChange={(e) => setEditingSkill({ ...editingSkill, category: e.target.value as Skill["category"] })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="Technical">Technical</option>
                  <option value="Soft Skills">Soft Skills</option>
                  <option value="Business">Business</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={editingSkill.description} onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditingSkill(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button disabled={saving} onClick={handleEditSkill} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Add New Skill</h2>
              <button onClick={() => setShowAddModal(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skill Name</label>
                <input type="text" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g., TypeScript" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={newSkill.category} onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value as Skill["category"] })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="Technical">Technical</option>
                  <option value="Soft Skills">Soft Skills</option>
                  <option value="Business">Business</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={newSkill.description} onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Describe this skill..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Skill (optional)</label>
                <select value={newSkill.parentId} onChange={(e) => setNewSkill({ ...newSkill, parentId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="">None (top-level skill)</option>
                  {skills.filter((s) => !s.parentId).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button disabled={saving} onClick={handleAddSkill} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {saving ? "Adding..." : "Add Skill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
