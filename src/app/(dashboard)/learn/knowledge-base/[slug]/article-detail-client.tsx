"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  Clock,
  User,
  ThumbsUp,
  ThumbsDown,
  Tag,
  BookOpen,
  FileText,
} from "lucide-react";
import { cn } from "@/utils/cn";
import type { KBArticleStatus } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────

export interface ArticleData {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: string;
  authorTitle: string;
  status: KBArticleStatus;
  isFaq: boolean;
  isPinned: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  viewCount: number;
}

export interface ArticleDetailClientProps {
  article: ArticleData;
  relatedArticles: RelatedArticle[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="mb-4 ml-6 list-disc space-y-1 text-gray-600">
          {listItems.map((item, i) => (
            <li key={i}>
              {item.split(/(\*\*.*?\*\*)/).map((part, j) =>
                part.startsWith("**") && part.endsWith("**") ? (
                  <strong key={j} className="font-semibold text-gray-900">
                    {part.slice(2, -2)}
                  </strong>
                ) : (
                  part
                )
              )}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={i} className="mb-4 mt-8 text-2xl font-bold text-gray-900 first:mt-0">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={i} className="mb-3 mt-6 text-lg font-semibold text-gray-900">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("#### ")) {
      flushList();
      elements.push(
        <h4 key={i} className="mb-2 mt-4 text-base font-semibold text-gray-800">
          {line.slice(5)}
        </h4>
      );
    } else if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      flushList();
      const match = line.match(/^\d+\.\s(.*)/);
      if (match) listItems.push(match[1]);
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={i} className="mb-4 leading-relaxed text-gray-600">
          {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j} className="font-semibold text-gray-900">
                {part.slice(2, -2)}
              </strong>
            ) : (
              part
            )
          )}
        </p>
      );
    }
  }
  flushList();
  return elements;
}

// ── Main Client Component ──────────────────────────────────────────────

export default function ArticleDetailClient({ article, relatedArticles }: ArticleDetailClientProps) {
  const [feedback, setFeedback] = useState<"helpful" | "not_helpful" | null>(null);
  const [helpfulCount, setHelpfulCount] = useState(article.helpfulCount);
  const [notHelpfulCount, setNotHelpfulCount] = useState(article.notHelpfulCount);

  const handleFeedback = (type: "helpful" | "not_helpful") => {
    if (feedback === type) return;
    if (feedback === "helpful") {
      setHelpfulCount((c) => c - 1);
    } else if (feedback === "not_helpful") {
      setNotHelpfulCount((c) => c - 1);
    }
    if (type === "helpful") {
      setHelpfulCount((c) => c + 1);
    } else {
      setNotHelpfulCount((c) => c + 1);
    }
    setFeedback(type);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/learn/knowledge-base" className="hover:text-indigo-600 transition-colors">
            Knowledge Base
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-500">{article.categoryName}</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium truncate max-w-xs">{article.title}</span>
        </nav>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <article className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="p-8">
                {/* Header */}
                <div className="mb-8">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                      {article.categoryName}
                    </span>
                    {article.isPinned && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        Pinned
                      </span>
                    )}
                    {article.isFaq && (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        FAQ
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                    {article.title}
                  </h1>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <User className="h-4 w-4" />
                      {article.author}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Updated {article.updatedAt}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-4 w-4" />
                      {formatNumber(article.viewCount)} views
                    </span>
                  </div>
                </div>

                {/* Tags */}
                <div className="mb-8 flex flex-wrap items-center gap-2">
                  <Tag className="h-4 w-4 text-gray-400" />
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Content */}
                <div className="prose-sm">{renderMarkdown(article.content)}</div>

                {/* Feedback */}
                <div className="mt-10 rounded-xl border border-gray-200 bg-gray-50 p-6">
                  <h3 className="text-base font-semibold text-gray-900">Was this article helpful?</h3>
                  <p className="mt-1 text-sm text-gray-500">Let us know if this answered your question</p>
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      onClick={() => handleFeedback("helpful")}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                        feedback === "helpful"
                          ? "border-green-300 bg-green-50 text-green-700"
                          : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                      )}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      Yes ({helpfulCount})
                    </button>
                    <button
                      onClick={() => handleFeedback("not_helpful")}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                        feedback === "not_helpful"
                          ? "border-red-300 bg-red-50 text-red-700"
                          : "border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                      )}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      No ({notHelpfulCount})
                    </button>
                  </div>
                  {feedback && (
                    <p className="mt-3 text-sm text-gray-500">
                      Thank you for your feedback! It helps us improve our knowledge base.
                    </p>
                  )}
                </div>
              </div>
            </article>

            {/* Back link */}
            <div className="mt-6">
              <Link
                href="/learn/knowledge-base"
                className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Knowledge Base
              </Link>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Article Info */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                Article Info
              </h3>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs text-gray-500">Author</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{article.author}</dd>
                  <dd className="text-xs text-gray-500">{article.authorTitle}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Published</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{article.createdAt}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Last Updated</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{article.updatedAt}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Views</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{formatNumber(article.viewCount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Helpfulness</dt>
                  <dd className="mt-1 flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-green-600">
                      <ThumbsUp className="h-3.5 w-3.5" /> {helpfulCount}
                    </span>
                    <span className="flex items-center gap-1 text-red-500">
                      <ThumbsDown className="h-3.5 w-3.5" /> {notHelpfulCount}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Related Articles */}
            {relatedArticles.length > 0 && (
              <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
                  <BookOpen className="h-4 w-4" />
                  Related Articles
                </h3>
                <div className="mt-4 space-y-3">
                  {relatedArticles.map((related) => (
                    <Link
                      key={related.id}
                      href={`/learn/knowledge-base/${related.slug}`}
                      className="block rounded-lg p-3 transition-colors hover:bg-gray-50"
                    >
                      <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
                        {related.title}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        <Eye className="h-3 w-3" /> {formatNumber(related.viewCount)} views
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
