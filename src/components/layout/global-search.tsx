"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, X, BookOpen, FileText, Users, File, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

interface SearchResults {
  courses: Array<{
    id: string;
    title: string;
    slug: string;
    thumbnail_url: string | null;
    status: string;
  }>;
  articles: Array<{
    id: string;
    title: string;
    slug: string;
    category_id: string | null;
  }>;
  users: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    file_type: string;
  }>;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

const emptyResults: SearchResults = {
  courses: [],
  articles: [],
  users: [],
  documents: [],
};

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(emptyResults);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onClose]);

  // Debounced search
  const fetchResults = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults(emptyResults);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const data: SearchResults = await res.json();
        setResults(data);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(value.trim()), 300);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const hasResults =
    results.courses.length > 0 ||
    results.articles.length > 0 ||
    results.users.length > 0 ||
    results.documents.length > 0;

  const hasQuery = query.trim().length >= 2;

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20"
    >
      <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search courses, articles, documents..."
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          {loading && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" aria-hidden="true" />
          )}
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close search"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {!hasQuery && !loading && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              Type at least 2 characters to search
            </div>
          )}

          {hasQuery && !loading && !hasResults && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No results found
            </div>
          )}

          {/* Courses */}
          {results.courses.length > 0 && (
            <ResultSection
              icon={<BookOpen className="h-4 w-4" />}
              label="Courses"
            >
              {results.courses.map((course) => (
                <ResultItem
                  key={course.id}
                  href={isAdmin ? `/admin/courses` : `/learn/catalog`}
                  title={course.title}
                  subtitle={course.status}
                  onClick={onClose}
                />
              ))}
            </ResultSection>
          )}

          {/* Articles */}
          {results.articles.length > 0 && (
            <ResultSection
              icon={<FileText className="h-4 w-4" />}
              label="Articles"
            >
              {results.articles.map((article) => (
                <ResultItem
                  key={article.id}
                  href="/learn/knowledge-base"
                  title={article.title}
                  subtitle={article.category_id ? `Category: ${article.category_id}` : "Uncategorized"}
                  onClick={onClose}
                />
              ))}
            </ResultSection>
          )}

          {/* Users */}
          {results.users.length > 0 && (
            <ResultSection
              icon={<Users className="h-4 w-4" />}
              label="Users"
            >
              {results.users.map((u) => (
                <ResultItem
                  key={u.id}
                  href="/admin/users"
                  title={`${u.first_name} ${u.last_name}`}
                  subtitle={u.role}
                  onClick={onClose}
                />
              ))}
            </ResultSection>
          )}

          {/* Documents */}
          {results.documents.length > 0 && (
            <ResultSection
              icon={<File className="h-4 w-4" />}
              label="Documents"
            >
              {results.documents.map((doc) => (
                <ResultItem
                  key={doc.id}
                  href="/learn/documents"
                  title={doc.title}
                  subtitle={doc.file_type?.toUpperCase() ?? "File"}
                  onClick={onClose}
                />
              ))}
            </ResultSection>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultSection({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ResultItem({
  href,
  title,
  subtitle,
  onClick,
}: {
  href: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
    >
      <span className="truncate font-medium text-gray-900">{title}</span>
      <span className="ml-2 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
        {subtitle}
      </span>
    </Link>
  );
}
