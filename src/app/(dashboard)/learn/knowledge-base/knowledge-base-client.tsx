"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Rocket,
  BookOpen,
  Award,
  Wrench,
  FileText,
  User,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Clock,
  ArrowRight,
  HelpCircle,
  Star,
} from "lucide-react";
import { cn } from "@/utils/cn";
import type { KBArticleStatus } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────

export interface KBCategoryView {
  id: string;
  name: string;
  description: string;
  icon: string;
  articleCount: number;
}

export interface KBArticleView {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  status: KBArticleStatus;
  isFaq: boolean;
  isPinned: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  categoryName: string;
}

// ── Icon Map ───────────────────────────────────────────────────────────

const ICON_MAP: Record<string, typeof Rocket> = {
  Rocket,
  BookOpen,
  Award,
  Wrench,
  FileText,
  User,
};

const ICON_BG: Record<string, string> = {
  Rocket: "bg-indigo-100 text-indigo-600",
  BookOpen: "bg-blue-100 text-blue-600",
  Award: "bg-amber-100 text-amber-600",
  Wrench: "bg-red-100 text-red-600",
  FileText: "bg-green-100 text-green-600",
  User: "bg-purple-100 text-purple-600",
};

// ── Helpers ────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// ── Components ─────────────────────────────────────────────────────────

function CategoryCard({ category, onClick }: { category: KBCategoryView; onClick: () => void }) {
  const IconComponent = ICON_MAP[category.icon] || HelpCircle;
  const iconBg = ICON_BG[category.icon] || "bg-gray-100 text-gray-600";

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
    >
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg", iconBg)}>
        <IconComponent className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 group-hover:text-indigo-600">
        {category.name}
      </h3>
      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{category.description}</p>
      <div className="mt-4 flex items-center gap-1 text-sm text-indigo-600">
        <span>{category.articleCount} {category.articleCount === 1 ? 'article' : 'articles'}</span>
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </button>
  );
}

function FAQItem({ article, searchQuery }: { article: KBArticleView; searchQuery: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="pr-4 text-base font-medium text-gray-900">
          {highlightMatch(article.title, searchQuery)}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 flex-shrink-0 text-gray-400 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div className="pb-5">
          <p className="text-sm leading-relaxed text-gray-600">
            {highlightMatch(article.excerpt, searchQuery)}
          </p>
          <Link
            href={`/learn/knowledge-base/${article.slug}`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Read full article <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-4">
            <span className="text-sm text-gray-500">Was this helpful?</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFeedback("yes");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                feedback === "yes"
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-gray-200 text-gray-500 hover:border-green-300 hover:bg-green-50 hover:text-green-700"
              )}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Yes
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFeedback("no");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                feedback === "no"
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-gray-200 text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              )}
            >
              <ThumbsDown className="h-3.5 w-3.5" /> No
            </button>
            {feedback && (
              <span className="text-xs text-gray-400">Thanks for your feedback!</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchResults({
  articles,
  searchQuery,
}: {
  articles: KBArticleView[];
  searchQuery: string;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, KBArticleView[]> = {};
    for (const article of articles) {
      const key = article.categoryName;
      if (!map[key]) map[key] = [];
      map[key].push(article);
    }
    return map;
  }, [articles]);

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center py-16">
        <Search className="h-16 w-16 text-gray-300" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No results found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Try different keywords or browse the categories below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-500">
        Found <span className="font-medium text-gray-900">{articles.length}</span> results for{" "}
        <span className="font-medium text-indigo-600">&quot;{searchQuery}&quot;</span>
      </p>
      {Object.entries(grouped).map(([categoryName, catArticles]) => (
        <div key={categoryName}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            {categoryName}
          </h3>
          <div className="space-y-2">
            {catArticles.map((article) => (
              <Link
                key={article.id}
                href={`/learn/knowledge-base/${article.slug}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-indigo-300 hover:shadow-sm"
              >
                <h4 className="font-medium text-gray-900">
                  {highlightMatch(article.title, searchQuery)}
                </h4>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {highlightMatch(article.excerpt, searchQuery)}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {formatNumber(article.viewCount)} views
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" /> {article.helpfulCount} helpful
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Client Component ──────────────────────────────────────────────

interface KnowledgeBaseClientProps {
  categories: KBCategoryView[];
  articles: KBArticleView[];
}

export default function KnowledgeBaseClient({ categories, articles }: KnowledgeBaseClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const isSearching = searchQuery.trim().length > 0;

  const filteredArticles = useMemo(() => {
    let results = articles;

    if (selectedCategory) {
      results = results.filter((a) => a.categoryId === selectedCategory);
    }

    if (isSearching) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.excerpt.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return results;
  }, [articles, searchQuery, selectedCategory, isSearching]);

  const faqArticles = articles.filter((a) => a.isFaq);
  const popularArticles = [...articles].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5);

  const selectedCategoryData = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">How can we help you?</h1>
          <p className="mt-3 text-lg text-indigo-200">
            Search our knowledge base or browse categories below
          </p>
          <div className="relative mt-8">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim()) setSelectedCategory(null);
              }}
              placeholder="Search for articles, topics, or keywords..."
              className="w-full rounded-xl border-0 bg-white py-4 pl-12 pr-4 text-gray-900 shadow-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Category filter breadcrumb */}
        {selectedCategory && selectedCategoryData && !isSearching && (
          <div className="mb-6 flex items-center gap-2 text-sm">
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-indigo-600 hover:text-indigo-700"
            >
              Knowledge Base
            </button>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-gray-900 font-medium">{selectedCategoryData.name}</span>
            <button
              onClick={() => setSelectedCategory(null)}
              className="ml-2 text-xs text-gray-400 hover:text-gray-600"
            >
              (clear filter)
            </button>
          </div>
        )}

        {/* Search Results */}
        {isSearching && (
          <div className="mb-12">
            <SearchResults articles={filteredArticles} searchQuery={searchQuery} />
          </div>
        )}

        {/* Filtered Category View */}
        {selectedCategory && !isSearching && (
          <div className="mb-12">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              {selectedCategoryData?.name} Articles
            </h2>
            <div className="space-y-3">
              {filteredArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/learn/knowledge-base/${article.slug}`}
                  className="block rounded-lg border border-gray-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{article.title}</h3>
                      <p className="mt-1 text-sm text-gray-500">{article.excerpt}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {article.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {formatNumber(article.viewCount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" /> {article.helpfulCount}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
              {filteredArticles.length === 0 && (
                <div className="flex flex-col items-center py-12">
                  <FileText className="h-12 w-12 text-gray-300" />
                  <p className="mt-3 text-gray-500">No articles in this category yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Default View: Categories + FAQ + Popular */}
        {!isSearching && !selectedCategory && (
          <>
            {/* Category Grid */}
            <section>
              <h2 className="mb-6 text-xl font-bold text-gray-900">Browse by Category</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    onClick={() => setSelectedCategory(category.id)}
                  />
                ))}
              </div>
            </section>

            {/* FAQ Section */}
            <section className="mt-16">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                  <HelpCircle className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Frequently Asked Questions</h2>
                  <p className="text-sm text-gray-500">Quick answers to common questions</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="divide-y divide-gray-200 px-6">
                  {faqArticles.map((article) => (
                    <FAQItem key={article.id} article={article} searchQuery="" />
                  ))}
                </div>
              </div>
            </section>

            {/* Popular Articles */}
            <section className="mt-16 mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Star className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Popular Articles</h2>
                  <p className="text-sm text-gray-500">Most viewed articles by learners</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="divide-y divide-gray-200">
                  {popularArticles.map((article, index) => (
                    <Link
                      key={article.id}
                      href={`/learn/knowledge-base/${article.slug}`}
                      className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50"
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{article.title}</h4>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            {article.categoryName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {formatNumber(article.viewCount)} views
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {article.updatedAt}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-300" />
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
