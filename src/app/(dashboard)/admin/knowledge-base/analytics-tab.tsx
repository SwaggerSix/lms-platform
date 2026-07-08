"use client";

import { AlertCircle, Eye, Search, ThumbsDown, ThumbsUp, TrendingUp } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatNumber, type AdminArticle } from "./kb-shared";

// Mock search analytics (kept client-side, not in DB)
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

export default function AnalyticsTab({ articles }: { articles: AdminArticle[] }) {
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
  );
}
