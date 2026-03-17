"use client";

import { useState } from "react";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Eye,
  MoreHorizontal,
  FileText,
  BarChart3,
  FolderOpen,
  ThumbsUp,
  ThumbsDown,
  GripVertical,
  ChevronDown,
  X,
  BookOpen,
  TrendingUp,
  HelpCircle,
  Archive,
  Globe,
  PenLine,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";
import type { KBArticleStatus } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────

export interface AdminArticle {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  status: KBArticleStatus;
  isFaq: boolean;
  isPinned: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  author: string;
  createdAt: string;
  updatedAt: string;
  excerpt: string;
  content: string;
  tags: string[];
}

export interface AdminCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
  articleCount: number;
}

interface ArticleForm {
  title: string;
  slug: string;
  categoryId: string;
  content: string;
  excerpt: string;
  tags: string;
  isFaq: boolean;
  isPinned: boolean;
  status: KBArticleStatus;
}

export interface KnowledgeBaseClientProps {
  initialArticles: AdminArticle[];
  initialCategories: AdminCategory[];
}

// ── Mock Search Analytics (kept client-side, not in DB) ───────────────

const SEARCH_TERMS_ANALYTICS = [
  { term: "password reset", count: 342 },
  { term: "enroll course", count: 289 },
  { term: "video not working", count: 234 },
  { term: "certificate download", count: 198 },
  { term: "compliance deadline", count: 167 },
  { term: "mobile app", count: 145 },
  { term: "SCORM error", count: 123 },
  { term: "learning path", count: 112 },
  { term: "profile update", count: 98 },
  { term: "browser support", count: 87 },
];

const EMPTY_FORM: ArticleForm = {
  title: "",
  slug: "",
  categoryId: "",
  content: "",
  excerpt: "",
  tags: "",
  isFaq: false,
  isPinned: false,
  status: "draft",
};

// ── Helpers ────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ── Status Badge ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: KBArticleStatus }) {
  const config: Record<KBArticleStatus, { label: string; icon: typeof Globe; className: string }> = {
    published: { label: "Published", icon: Globe, className: "bg-green-50 text-green-700 ring-green-600/20" },
    draft: { label: "Draft", icon: PenLine, className: "bg-amber-50 text-amber-700 ring-amber-600/20" },
    archived: { label: "Archived", icon: Archive, className: "bg-gray-100 text-gray-500 ring-gray-500/20" },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", c.className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────

const TABS = [
  { key: "articles", label: "Articles", icon: FileText },
  { key: "categories", label: "Categories", icon: FolderOpen },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ── Main Client Component ─────────────────────────────────────────────

export default function KnowledgeBaseClient({ initialArticles, initialCategories }: KnowledgeBaseClientProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("articles");
  const [articles, setArticles] = useState(initialArticles);
  const [categories, setCategories] = useState(initialCategories);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | KBArticleStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<string | null>(null);
  const [form, setForm] = useState<ArticleForm>(EMPTY_FORM);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", icon: "FileText" });

  // ── Article Filtering ──

  const filteredArticles = articles.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (categoryFilter !== "all" && a.categoryId !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q));
    }
    return true;
  });

  // ── Article CRUD ──

  const openCreateModal = () => {
    setEditingArticle(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (article: AdminArticle) => {
    setEditingArticle(article.id);
    setForm({
      title: article.title,
      slug: article.slug,
      categoryId: article.categoryId,
      content: article.content,
      excerpt: article.excerpt,
      tags: article.tags.join(", "),
      isFaq: article.isFaq,
      isPinned: article.isPinned,
      status: article.status,
    });
    setShowModal(true);
    setOpenMenu(null);
  };

  const handleSaveArticle = async () => {
    if (!form.title.trim()) return;

    const slug = form.slug || generateSlug(form.title);
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);

    try {
      if (editingArticle) {
        const res = await fetch("/api/knowledge-base", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingArticle,
            title: form.title,
            slug,
            category_id: form.categoryId || null,
            content: form.content,
            excerpt: form.excerpt,
            tags,
            is_faq: form.isFaq,
            is_pinned: form.isPinned,
            status: form.status,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update article");
        }
        setArticles((prev) =>
          prev.map((a) =>
            a.id === editingArticle
              ? {
                  ...a,
                  title: form.title,
                  slug,
                  categoryId: form.categoryId,
                  categoryName: categories.find((c) => c.id === form.categoryId)?.name || a.categoryName,
                  content: form.content,
                  excerpt: form.excerpt,
                  tags,
                  isFaq: form.isFaq,
                  isPinned: form.isPinned,
                  status: form.status,
                  updatedAt: new Date().toISOString().split("T")[0],
                }
              : a
          )
        );
      } else {
        const res = await fetch("/api/knowledge-base", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            slug,
            content: form.content,
            excerpt: form.excerpt,
            category_id: form.categoryId || null,
            status: form.status,
            is_faq: form.isFaq,
            is_pinned: form.isPinned,
            tags,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create article");
        }
        const created = await res.json();
        const newArticle: AdminArticle = {
          id: created.id,
          title: form.title,
          slug,
          categoryId: form.categoryId,
          categoryName: categories.find((c) => c.id === form.categoryId)?.name || "Uncategorized",
          status: form.status,
          isFaq: form.isFaq,
          isPinned: form.isPinned,
          viewCount: 0,
          helpfulCount: 0,
          notHelpfulCount: 0,
          author: "Admin User",
          createdAt: new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString().split("T")[0],
          excerpt: form.excerpt,
          content: form.content,
          tags,
        };
        setArticles((prev) => [newArticle, ...prev]);
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred saving the article");
    }
  };

  const handleDeleteArticle = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge-base?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete article");
      }
      setArticles((prev) => prev.filter((a) => a.id !== id));
      setOpenMenu(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred deleting the article");
    }
  };

  // ── Category CRUD ──

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", description: "", icon: "FileText" });
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: AdminCategory) => {
    setEditingCategory(cat.id);
    setCategoryForm({ name: cat.name, description: cat.description, icon: cat.icon });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return;

    try {
      if (editingCategory) {
        const res = await fetch("/api/knowledge-base", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "category",
            id: editingCategory,
            name: categoryForm.name,
            description: categoryForm.description,
            icon: categoryForm.icon,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update category");
        }
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingCategory
              ? { ...c, name: categoryForm.name, description: categoryForm.description, icon: categoryForm.icon }
              : c
          )
        );
      } else {
        const res = await fetch("/api/knowledge-base", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "category",
            name: categoryForm.name,
            description: categoryForm.description,
            icon: categoryForm.icon,
            sort_order: categories.length + 1,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create category");
        }
        const created = await res.json();
        const newCat: AdminCategory = {
          id: created.id,
          name: categoryForm.name,
          description: categoryForm.description,
          icon: categoryForm.icon,
          sortOrder: created.sort_order ?? categories.length + 1,
          articleCount: 0,
        };
        setCategories((prev) => [...prev, newCat]);
      }
      setShowCategoryModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred saving the category");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge-base?type=category&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete category");
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred deleting the category");
    }
  };

  // ── Analytics Data ──

  const totalViews = articles.reduce((sum, a) => sum + a.viewCount, 0);
  const totalHelpful = articles.reduce((sum, a) => sum + a.helpfulCount, 0);
  const totalNotHelpful = articles.reduce((sum, a) => sum + a.notHelpfulCount, 0);
  const helpfulRatio = totalHelpful + totalNotHelpful > 0 ? Math.round((totalHelpful / (totalHelpful + totalNotHelpful)) * 100) : 0;
  const topArticles = [...articles].sort((a, b) => b.viewCount - a.viewCount).slice(0, 8);
  const leastHelpful = [...articles]
    .filter((a) => a.helpfulCount + a.notHelpfulCount > 10)
    .sort((a, b) => {
      const ratioA = a.helpfulCount / (a.helpfulCount + a.notHelpfulCount);
      const ratioB = b.helpfulCount / (b.helpfulCount + b.notHelpfulCount);
      return ratioA - ratioB;
    })
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Knowledge Base Management</h1>
              <p className="mt-1 text-gray-500">Create and manage help articles, FAQs, and categories</p>
            </div>
          </div>
          {activeTab === "articles" && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> New Article
            </button>
          )}
          {activeTab === "categories" && (
            <button
              onClick={openCreateCategory}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> New Category
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-8 border-b border-gray-200">
          <nav className="flex gap-6">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors",
                    activeTab === tab.key ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ═══ Articles Tab ═══ */}
        {activeTab === "articles" && (
          <div className="mt-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Articles Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Views</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">FAQ</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredArticles.map((article) => (
                    <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{article.title}</p>
                          <p className="mt-0.5 text-xs text-gray-400">by {article.author} / {article.updatedAt}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {article.categoryName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={article.status} />
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">
                        {formatNumber(article.viewCount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {article.isFaq ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenMenu(openMenu === article.id ? null : article.id)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openMenu === article.id && (
                            <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                              <button
                                onClick={() => openEditModal(article)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Edit3 className="h-4 w-4" /> Edit Article
                              </button>
                              <button
                                onClick={() => {
                                  window.open(`/learn/knowledge-base/${article.slug}`, "_blank");
                                  setOpenMenu(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Eye className="h-4 w-4" /> View Article
                              </button>
                              <hr className="my-1 border-gray-100" />
                              <button
                                onClick={() => handleDeleteArticle(article.id)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredArticles.length === 0 && (
                <div className="flex flex-col items-center py-12">
                  <FileText className="h-12 w-12 text-gray-300" />
                  <p className="mt-3 text-sm text-gray-500">No articles found matching your filters.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ Categories Tab ═══ */}
        {activeTab === "categories" && (
          <div className="mt-6">
            <div className="space-y-3">
              {categories
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm"
                  >
                    <GripVertical className="h-5 w-5 flex-shrink-0 cursor-grab text-gray-300" />
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                      <FolderOpen className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">{cat.name}</h3>
                      <p className="text-xs text-gray-500 truncate">{cat.description}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      {cat.articleCount} articles
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditCategory(cat)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            {categories.length === 0 && (
              <div className="flex flex-col items-center py-12">
                <FolderOpen className="h-12 w-12 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">No categories yet. Create your first one.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ Analytics Tab ═══ */}
        {activeTab === "analytics" && (
          <div className="mt-6 space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <Eye className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(totalViews)}</p>
                    <p className="text-sm text-gray-500">Total Views</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <ThumbsUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(totalHelpful)}</p>
                    <p className="text-sm text-gray-500">Helpful Votes</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                    <ThumbsDown className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(totalNotHelpful)}</p>
                    <p className="text-sm text-gray-500">Not Helpful Votes</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{helpfulRatio}%</p>
                    <p className="text-sm text-gray-500">Helpful Ratio</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Most Viewed Articles */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    Most Viewed Articles
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {topArticles.map((article, index) => (
                    <div key={article.id} className="flex items-center gap-4 px-6 py-3">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{article.title}</p>
                        <p className="text-xs text-gray-400">{article.categoryName}</p>
                      </div>
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <Eye className="h-3.5 w-3.5" /> {formatNumber(article.viewCount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Search Terms */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                    <Search className="h-5 w-5 text-indigo-600" />
                    Top Search Terms
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {SEARCH_TERMS_ANALYTICS.map((item, index) => {
                    const maxCount = SEARCH_TERMS_ANALYTICS[0].count;
                    const width = Math.round((item.count / maxCount) * 100);
                    return (
                      <div key={item.term} className="flex items-center gap-4 px-6 py-3">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{item.term}</p>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">{item.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Least Helpful Articles */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Articles Needing Improvement
                  <span className="text-sm font-normal text-gray-400">(lowest helpful ratio with 10+ votes)</span>
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {leastHelpful.map((article) => {
                  const total = article.helpfulCount + article.notHelpfulCount;
                  const ratio = total > 0 ? Math.round((article.helpfulCount / total) * 100) : 0;
                  return (
                    <div key={article.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{article.title}</p>
                        <p className="text-xs text-gray-400">{article.categoryName}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <ThumbsUp className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-gray-600">{article.helpfulCount}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
                          <span className="text-gray-600">{article.notHelpfulCount}</span>
                        </div>
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          ratio >= 80 ? "bg-green-100 text-green-700" :
                          ratio >= 60 ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {ratio}% helpful
                        </span>
                      </div>
                    </div>
                  );
                })}
                {leastHelpful.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                    No articles with enough votes to analyze yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Article Modal ═══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingArticle ? "Edit Article" : "Create New Article"}
              </h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value, slug: form.slug || generateSlug(e.target.value) });
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Article title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="auto-generated-from-title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
                <input
                  type="text"
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Brief summary of the article"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={10}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Write your article content here (supports markdown-style formatting)..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="tag1, tag2, tag3"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as KBArticleStatus })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="flex flex-col gap-3 pt-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isFaq}
                      onChange={(e) => setForm({ ...form, isFaq: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700">Show in FAQ</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isPinned}
                      onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700">Pin article</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveArticle}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {editingArticle ? "Save Changes" : "Create Article"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Category Modal ═══ */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCategory ? "Edit Category" : "Create New Category"}
              </h2>
              <button onClick={() => setShowCategoryModal(false)} className="rounded-lg p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Category name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Brief description of this category"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <select
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Rocket">Rocket</option>
                  <option value="BookOpen">BookOpen</option>
                  <option value="Award">Award</option>
                  <option value="Wrench">Wrench</option>
                  <option value="FileText">FileText</option>
                  <option value="User">User</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {editingCategory ? "Save Changes" : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
