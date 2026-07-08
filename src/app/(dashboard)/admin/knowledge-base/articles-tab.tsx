"use client";

import { useState } from "react";
import { CheckCircle2, Edit3, Eye, FileText, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { KBArticleStatus } from "@/types/database";
import { formatNumber, StatusBadge, type AdminArticle, type AdminCategory } from "./kb-shared";

interface ArticlesTabProps {
  articles: AdminArticle[];
  categories: AdminCategory[];
  canManage: boolean;
  onEdit: (article: AdminArticle) => void;
  onDelete: (id: string) => void;
}

export default function ArticlesTab({ articles, categories, canManage, onEdit, onDelete }: ArticlesTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | KBArticleStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filteredArticles = articles.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (categoryFilter !== "all" && a.categoryId !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q));
    }
    return true;
  });

  return (
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
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="all">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
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
                      <span className="sr-only">Actions for {article.title}</span>
                    </button>
                    {openMenu === article.id && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <button
                          onClick={() => {
                            onEdit(article);
                            setOpenMenu(null);
                          }}
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
                        {canManage && (
                          <>
                            <hr className="my-1 border-gray-100" />
                            <button
                              onClick={() => {
                                onDelete(article.id);
                                setOpenMenu(null);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredArticles.length === 0 && (
          <EmptyState
            icon={<FileText className="h-10 w-10" aria-hidden="true" />}
            title="No articles found matching your filters."
          />
        )}
      </div>
    </div>
  );
}
