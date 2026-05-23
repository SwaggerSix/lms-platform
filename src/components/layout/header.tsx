"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
import {
  Menu,
  Search,
  Bell,
  ChevronRight,
  User,
  LogOut,
  Settings,
  X,
} from "lucide-react";
import { useRealtimeSubscription } from "@/hooks/use-realtime";
import { useNotificationStore } from "@/stores/notification-store";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import GlobalSearch from "@/components/layout/global-search";
import { RelativeTime } from "@/components/ui/relative-time";
import { RelativeTimeProvider } from "@/components/ui/relative-time-context";
import type { Notification } from "@/types/database";

function generateBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, idx) => ({
    label: segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    href: "/" + segments.slice(0, idx + 1).join("/"),
    isLast: idx === segments.length - 1,
  }));
}

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const breadcrumbs = generateBreadcrumbs(pathname);

  // --- Supabase client (stable across renders) ---
  const supabase = useMemo(() => createClient(), []);

  // --- Auth store ---
  const { user: authUser } = useAuth();
  const userId = authUser?.id ?? "";
  const userInitials = authUser
    ? `${authUser.first_name[0]}${authUser.last_name[0]}`
    : "?";
  const userFullName = authUser
    ? `${authUser.first_name} ${authUser.last_name}`
    : "Loading...";
  const userEmail = authUser?.email ?? "";

  // --- Notification store ---
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
  } = useNotificationStore();

  // Fetch notifications on mount when user is available
  useEffect(() => {
    if (userId) {
      fetchNotifications();
    }
  }, [fetchNotifications, userId]);

  // Subscribe to new notifications in real-time
  useRealtimeSubscription(supabase, {
    table: "notifications",
    event: "INSERT",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    onData: (payload) => {
      const newNotif = payload.new as unknown as Notification;
      if (newNotif.channel !== "in_app") return;
      useNotificationStore.setState((state) => ({
        notifications: [newNotif, ...state.notifications],
        unreadCount: state.unreadCount + (newNotif.is_read ? 0 : 1),
      }));
    },
  });

  // Close dropdowns on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setNotifOpen(false);
      setUserOpen(false);
      setSearchOpen(false);
    }
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <header
      className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6"
      role="banner"
    >
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Breadcrumbs - Desktop */}
        <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-sm md:flex">
          <ol className="flex items-center gap-1">
            {breadcrumbs.map((crumb, idx) => (
              <li key={crumb.href} className="flex items-center gap-1">
                {idx > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                )}
                {crumb.isLast ? (
                  <span className="font-medium text-gray-900" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Breadcrumbs - Mobile (current page title only) */}
        {breadcrumbs.length > 0 && (
          <span className="truncate text-sm font-medium text-gray-900 md:hidden" aria-current="page">
            {breadcrumbs[breadcrumbs.length - 1].label}
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Open search"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setUserOpen(false);
            }}
            className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={notifOpen}
            aria-haspopup="true"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
                aria-hidden="true"
              >
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl"
              role="menu"
              aria-label="Notifications"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Notifications
                </h3>
                <button
                  onClick={() => {
                    if (userId) {
                      const { markAllAsRead } = useNotificationStore.getState();
                      markAllAsRead();
                    }
                  }}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 focus:outline-none focus:underline"
                  role="menuitem"
                >
                  Mark all read
                </button>
              </div>
              {/* RelativeTimeProvider folds the N per-row intervals into one
                  shared tick — important when 10 notifications each used to
                  spin their own setInterval. */}
              <RelativeTimeProvider>
              <div className="max-h-80 overflow-y-auto" role="list">
                {notifications.slice(0, 10).map((notif) => {
                  const body = (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                            {notif.body}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!notif.is_read && (
                          <span
                            aria-label="Unread"
                            className="h-2 w-2 rounded-full bg-indigo-500"
                          />
                        )}
                        <RelativeTime
                          iso={notif.created_at}
                          className="text-[11px] text-gray-500"
                        />
                      </div>
                    </div>
                  );

                  const className = cn(
                    "block w-full text-left border-b border-gray-50 px-4 py-3 transition-colors hover:bg-gray-50",
                    !notif.is_read && "bg-indigo-50/50"
                  );

                  if (notif.link) {
                    return (
                      <Link
                        key={notif.id}
                        href={notif.link}
                        role="listitem"
                        className={className}
                        onClick={() => {
                          if (!notif.is_read) markAsRead(notif.id);
                        }}
                      >
                        {body}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={notif.id}
                      type="button"
                      role="listitem"
                      className={className}
                      onClick={() => {
                        if (!notif.is_read) markAsRead(notif.id);
                      }}
                    >
                      {body}
                    </button>
                  );
                })}
              </div>
              </RelativeTimeProvider>
              <div className="border-t border-gray-100 px-4 py-2">
                <Link
                  href="/notifications"
                  className="block text-center text-xs font-medium text-indigo-600 hover:text-indigo-700 focus:outline-none focus:underline"
                  onClick={() => setNotifOpen(false)}
                  role="menuitem"
                >
                  View all notifications
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => {
              setUserOpen(!userOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="User menu"
            aria-expanded={userOpen}
            aria-haspopup="true"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
              aria-hidden="true"
            >
              {userInitials}
            </div>
          </button>

          {userOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
              role="menu"
              aria-label="User menu"
            >
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{userFullName}</p>
                <p className="text-xs text-gray-500">{userEmail}</p>
              </div>
              <Link
                href="/profile"
                onClick={() => setUserOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                role="menuitem"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Profile
              </Link>
              <Link
                href="/profile/settings"
                onClick={() => setUserOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                role="menuitem"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </Link>
              <div className="border-t border-gray-100">
                <button
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    window.location.href = "/login";
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
