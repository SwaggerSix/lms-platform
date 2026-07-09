"use client";

import { useState } from "react";
import { BarChart3, BookOpen, FileText, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { ResultLimitNotice } from "@/components/ui/result-limit-notice";
import type { AdminArticle, AdminCategory } from "./kb-shared";
import ArticlesTab from "./articles-tab";
import CategoriesTab from "./categories-tab";
import AnalyticsTab from "./analytics-tab";
import ArticleModal from "./article-modal";
import CategoryModal from "./category-modal";

export interface KnowledgeBaseClientProps {
  initialArticles: AdminArticle[];
  initialCategories: AdminCategory[];
  /** Total articles matching in the DB (may exceed the loaded/capped set). */
  totalArticles?: number;
  /** Full management rights (delete, analytics). Admins only; instructors can add/edit but not delete. */
  canManage?: boolean;
}

const TABS = [
  { key: "articles", label: "Articles", icon: FileText },
  { key: "categories", label: "Categories", icon: FolderOpen },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function KnowledgeBaseClient({ initialArticles, initialCategories, totalArticles, canManage = true }: KnowledgeBaseClientProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("articles");
  const [articles, setArticles] = useState(initialArticles);
  const [categories, setCategories] = useState(initialCategories);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<AdminArticle | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);

  const handleArticleSaved = (saved: AdminArticle) => {
    setArticles((prev) =>
      prev.some((a) => a.id === saved.id)
        ? prev.map((a) => (a.id === saved.id ? saved : a))
        : [saved, ...prev]
    );
  };

  const handleCategorySaved = (saved: AdminCategory) => {
    setCategories((prev) =>
      prev.some((c) => c.id === saved.id)
        ? prev.map((c) => (c.id === saved.id ? saved : c))
        : [...prev, saved]
    );
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred deleting the article");
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Knowledge Base Management</h1>
              <p className="mt-1 text-gray-500">Create and manage help articles, FAQs, and categories</p>
            </div>
          </div>
          {activeTab === "articles" && (
            <Button
              onClick={() => {
                setEditingArticle(null);
                setShowArticleModal(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Article
            </Button>
          )}
          {activeTab === "categories" && (
            <Button
              onClick={() => {
                setEditingCategory(null);
                setShowCategoryModal(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Category
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v as TabKey)} className="mt-8">
          <TabsList>
            {TABS.filter((tab) => canManage || tab.key !== "analytics").map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.key} value={tab.key}>
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {activeTab === "articles" && (
          <>
            <ResultLimitNotice
              shown={articles.length}
              total={totalArticles ?? articles.length}
              noun="articles"
              className="mt-6 mb-3"
            />
            <ArticlesTab
              articles={articles}
              categories={categories}
              canManage={canManage}
              onEdit={(article) => {
                setEditingArticle(article);
                setShowArticleModal(true);
              }}
              onDelete={handleDeleteArticle}
            />
          </>
        )}

        {activeTab === "categories" && (
          <CategoriesTab
            categories={categories}
            canManage={canManage}
            onEdit={(cat) => {
              setEditingCategory(cat);
              setShowCategoryModal(true);
            }}
            onDelete={handleDeleteCategory}
          />
        )}

        {activeTab === "analytics" && <AnalyticsTab articles={articles} />}
      </div>

      {showArticleModal && (
        <ArticleModal
          article={editingArticle}
          categories={categories}
          onClose={() => setShowArticleModal(false)}
          onSaved={handleArticleSaved}
        />
      )}

      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          categoryCount={categories.length}
          onClose={() => setShowCategoryModal(false)}
          onSaved={handleCategorySaved}
        />
      )}
    </div>
  );
}
