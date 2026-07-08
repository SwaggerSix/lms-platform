"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { KBArticleStatus } from "@/types/database";
import { generateSlug, type AdminArticle, type AdminCategory } from "./kb-shared";

interface ArticleModalProps {
  /** Non-null when editing; null when creating. */
  article: AdminArticle | null;
  categories: AdminCategory[];
  onClose: () => void;
  /** Called with the created/updated article; the parent updates its list. */
  onSaved: (article: AdminArticle) => void;
}

export default function ArticleModal({ article, categories, onClose, onSaved }: ArticleModalProps) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: article?.title ?? "",
    slug: article?.slug ?? "",
    categoryId: article?.categoryId ?? "",
    content: article?.content ?? "",
    excerpt: article?.excerpt ?? "",
    tags: article?.tags.join(", ") ?? "",
    isFaq: article?.isFaq ?? false,
    isPinned: article?.isPinned ?? false,
    status: (article?.status ?? "draft") as KBArticleStatus,
  });

  const handleSaveArticle = async () => {
    if (!form.title.trim()) return;

    const slug = form.slug || generateSlug(form.title);
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const categoryName = categories.find((c) => c.id === form.categoryId)?.name;

    try {
      if (article) {
        const res = await fetch("/api/knowledge-base", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: article.id,
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
        onSaved({
          ...article,
          title: form.title,
          slug,
          categoryId: form.categoryId,
          categoryName: categoryName || article.categoryName,
          content: form.content,
          excerpt: form.excerpt,
          tags,
          isFaq: form.isFaq,
          isPinned: form.isPinned,
          status: form.status,
          updatedAt: new Date().toISOString().split("T")[0],
        });
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
        onSaved({
          id: created.id,
          title: form.title,
          slug,
          categoryId: form.categoryId,
          categoryName: categoryName || "Uncategorized",
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
        });
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred saving the article");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {article ? "Edit Article" : "Create New Article"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:text-gray-600">
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Article title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="auto-generated-from-title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Brief summary of the article"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={10}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Write your article content here (supports markdown-style formatting)..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as KBArticleStatus })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-700">Show in FAQ</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-700">Pin article</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveArticle}>
            {article ? "Save Changes" : "Create Article"}
          </Button>
        </div>
      </div>
    </div>
  );
}
