"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  locales,
  localeNames,
  localeFlags,
  type Locale,
} from "@/i18n/config";

interface LanguageSelectorProps {
  currentLocale: string;
  compact?: boolean;
  className?: string;
}

export default function LanguageSelector({
  currentLocale,
  compact = false,
  className,
}: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleSelect = async (locale: Locale) => {
    if (locale === currentLocale) {
      setOpen(false);
      return;
    }

    setSaving(true);

    // Set cookie
    document.cookie = `lms-locale=${locale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;

    // Try to save to user preferences (will fail silently if not authenticated)
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: { locale },
        }),
      });
    } catch {
      // Silently ignore - cookie is already set
    }

    // Reload page to apply new locale
    window.location.reload();
  };

  const current = currentLocale as Locale;
  const flag = localeFlags[current] || localeFlags.en;
  const name = localeNames[current] || localeNames.en;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        aria-label="Change language"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex items-center gap-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2",
          compact
            ? "p-2 text-gray-500 hover:bg-gray-100"
            : "border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50",
          saving && "opacity-50 cursor-not-allowed"
        )}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        {!compact && (
          <>
            <span className="hidden sm:inline">{flag} {name}</span>
            <span className="sm:hidden">{flag}</span>
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
          role="listbox"
          aria-label="Select language"
        >
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => handleSelect(locale)}
              role="option"
              aria-selected={locale === currentLocale}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-gray-50",
                locale === currentLocale
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-700"
              )}
            >
              <span className="text-base" aria-hidden="true">
                {localeFlags[locale]}
              </span>
              <span className="flex-1 text-left">{localeNames[locale]}</span>
              {locale === currentLocale && (
                <Check className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
