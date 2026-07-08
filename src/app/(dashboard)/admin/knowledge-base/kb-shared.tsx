import { Archive, Globe, PenLine } from "lucide-react";
import { cn } from "@/utils/cn";
import type { KBArticleStatus } from "@/types/database";

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

export function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function StatusBadge({ status }: { status: KBArticleStatus }) {
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
