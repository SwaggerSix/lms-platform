"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  Library,
  Route,
  Award,
  Trophy,
  MessageSquare,
  MessagesSquare,
  Users,
  ClipboardList,
  ClipboardCheck,
  ShieldCheck,
  BarChart3,
  UserCog,
  Building2,
  GitBranch,
  FileQuestion,
  Medal,
  Scale,
  Sparkles,
  Gamepad2,
  PieChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  ChevronDown,
  Mail,
  FolderOpen,
  HelpCircle,
  FileText,
  CalendarDays,
  CheckSquare,
  Clock,
  History,
  KeyRound,
  Zap,
  ShoppingCart,
  ShoppingBag,
  Bot,
  Heart,
  Puzzle,
  Store,
  BookMarked,
  BrainCircuit,
  Network,
  Globe,
  Eye,
  Workflow,
  Link2,
  TrendingUp,
  Wand2,
  MessageSquareMore,
  Bug,
  Video,
} from "lucide-react";
import { useLocale } from "next-intl";
import LanguageSelector from "@/components/ui/language-selector";
import { roleLabel } from "@/lib/auth/roles";

type Role = "learner" | "manager" | "instructor" | "admin" | "super_admin";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  featureKey?: string; // maps to platform_settings.features or tenant.features
}

interface NavSection {
  header?: string;
  items: NavItem[];
  roles: Role[];
  /** Optional slightly-tinted background to visually separate the role group. */
  bgClass?: string;
}

const navSections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Help & Manuals", href: "/help", icon: HelpCircle },
    ],
    roles: ["learner", "manager", "instructor", "admin", "super_admin"],
  },
  {
    header: "Learning",
    items: [
      { label: "Course Catalog", href: "/learn/catalog", icon: BookOpen, featureKey: "courses" },
      { label: "My Courses", href: "/learn/my-courses", icon: Library, featureKey: "courses" },
      { label: "My Classes", href: "/learn/classes", icon: CalendarDays, featureKey: "classes" },
      { label: "Learning Paths", href: "/learn/paths", icon: Route, featureKey: "learning_paths" },
      { label: "Certifications", href: "/learn/certifications", icon: Award, featureKey: "certifications" },
      { label: "Transcript", href: "/learn/transcript", icon: FileText, featureKey: "courses" },
      { label: "Webinars", href: "/learn/ilt-sessions", icon: CalendarDays, featureKey: "ilt_sessions" },
      { label: "Achievements", href: "/learn/achievements", icon: Trophy, featureKey: "gamification" },
      { label: "Discussions", href: "/learn/discussions", icon: MessageSquare, featureKey: "social_learning" },
      { label: "Messages", href: "/learn/messages", icon: Mail, featureKey: "social_learning" },
      { label: "Documents", href: "/learn/documents", icon: FolderOpen, featureKey: "documents" },
      { label: "Knowledge Base", href: "/learn/knowledge-base", icon: BookMarked, featureKey: "knowledge_base" },
      { label: "AI Chat", href: "/learn/chat", icon: Bot, featureKey: "ai_chat" },
      { label: "Mentorship", href: "/learn/mentorship", icon: Heart, featureKey: "mentorship" },
      { label: "Microlearning", href: "/learn/microlearning", icon: Puzzle, featureKey: "microlearning" },
      { label: "Marketplace", href: "/learn/marketplace", icon: Store, featureKey: "marketplace" },
      { label: "Shop", href: "/shop", icon: ShoppingCart, featureKey: "ecommerce" },
      { label: "360 Feedback", href: "/learn/feedback", icon: MessagesSquare, featureKey: "feedback_360" },
      { label: "Observations", href: "/learn/observations", icon: Eye, featureKey: "observations" },
      { label: "Evaluations", href: "/learn/evaluations", icon: ClipboardCheck, featureKey: "evaluations" },
      { label: "Nudges", href: "/learn/nudges", icon: Zap, featureKey: "nudges" },
    ],
    roles: ["learner", "manager", "admin", "super_admin"],
  },
  {
    header: "INSTRUCTOR",
    items: [
      { label: "My Classes", href: "/instructor/classes", icon: GraduationCap },
      { label: "My Bio", href: "/instructor/bio", icon: User },
      { label: "My Certifications", href: "/instructor/certifications", icon: Medal },
      { label: "Nudges", href: "/admin/nudges", icon: Zap, featureKey: "nudges" },
      { label: "Messages", href: "/learn/messages", icon: Mail },
      { label: "Documents", href: "/admin/documents", icon: FolderOpen },
      { label: "Knowledge Base", href: "/admin/knowledge-base", icon: HelpCircle },
    ],
    roles: ["instructor", "admin", "super_admin"],
    bgClass: "bg-gray-800/30",
  },
  {
    // Instructors don't see the Learning or Administration sections, so this
    // section carries their day-to-day links. Admins reach the same pages via
    // the Administration sections, which keeps the sidebar free of duplicates.
    header: "Instructor",
    items: [
      { label: "My Classes", href: "/instructor/classes", icon: GraduationCap },
      { label: "My Certifications", href: "/instructor/certifications", icon: Medal },
      { label: "Nudges", href: "/admin/nudges", icon: Zap, featureKey: "nudges" },
      { label: "Messages", href: "/learn/messages", icon: Mail, featureKey: "social_learning" },
      { label: "Documents", href: "/admin/documents", icon: FolderOpen },
      { label: "Knowledge Base", href: "/admin/knowledge-base", icon: BookMarked },
    ],
    roles: ["instructor"],
    bgClass: "bg-gray-800/30",
  },
  {
    header: "Management",
    items: [
      { label: "My Team", href: "/manager/team", icon: Users },
      { label: "Approvals", href: "/manager/approvals", icon: CheckSquare },
      { label: "Assignments", href: "/manager/assignments", icon: ClipboardList },
      { label: "Compliance", href: "/manager/compliance", icon: ShieldCheck },
      { label: "Team Skills", href: "/manager/skills", icon: BarChart3 },
      { label: "Team Analytics", href: "/manager/analytics", icon: TrendingUp },
      { label: "Nudges", href: "/manager/nudges", icon: Zap, featureKey: "nudges" },
    ],
    roles: ["manager", "admin", "super_admin"],
    bgClass: "bg-gray-800/30",
  },
  {
    header: "Admin · People & Courses",
    items: [
      { label: "Users", href: "/admin/users", icon: UserCog },
      { label: "Organizations", href: "/admin/organizations", icon: Building2 },
      { label: "Courses", href: "/admin/courses", icon: GraduationCap, featureKey: "courses" },
      { label: "Webinars", href: "/admin/ilt-sessions", icon: CalendarDays, featureKey: "ilt_sessions" },
      { label: "Shared Webinars", href: "/admin/shared-webinars", icon: Video, featureKey: "ilt_sessions" },
      { label: "Learning Paths", href: "/admin/paths", icon: GitBranch, featureKey: "learning_paths" },
      { label: "Assessments", href: "/admin/assessments", icon: FileQuestion, featureKey: "assessments" },
      { label: "Exam Results", href: "/admin/assessments/results", icon: ClipboardCheck, featureKey: "assessments" },
      { label: "Exam Grading", href: "/admin/assessments/grading", icon: CheckSquare, featureKey: "assessments" },
      { label: "Certifications", href: "/admin/certifications", icon: Medal, featureKey: "certifications" },
      { label: "Instructor Certifications", href: "/admin/instructor-certifications", icon: ShieldCheck },
      { label: "ILT Session Log", href: "/admin/training-events", icon: History, featureKey: "ilt_sessions" },
    ],
    roles: ["admin", "super_admin"],
    bgClass: "bg-gray-800/60",
  },
  {
    header: "Admin · Governance",
    items: [
      { label: "Compliance", href: "/admin/compliance", icon: Scale },
      { label: "Approvals", href: "/admin/approvals", icon: CheckSquare },
      { label: "Skills", href: "/admin/skills", icon: Sparkles },
      { label: "Reports", href: "/admin/reports", icon: PieChart },
      { label: "Scheduled Reports", href: "/admin/scheduled-reports", icon: Clock },
      { label: "Workflows", href: "/admin/workflows", icon: Workflow },
      { label: "Error Log", href: "/admin/settings/error-log", icon: Bug },
    ],
    roles: ["admin", "super_admin"],
    bgClass: "bg-gray-800/60",
  },
  {
    header: "Admin · Engagement",
    items: [
      { label: "Documents", href: "/admin/documents", icon: FolderOpen },
      { label: "Knowledge Base", href: "/admin/knowledge-base", icon: BookMarked },
      { label: "Gamification", href: "/admin/gamification", icon: Gamepad2, featureKey: "gamification" },
      { label: "360 Feedback", href: "/admin/feedback", icon: MessagesSquare, featureKey: "feedback_360" },
      { label: "Mentorship", href: "/admin/mentorship", icon: Heart, featureKey: "mentorship" },
      { label: "Observations", href: "/admin/observations", icon: Eye, featureKey: "observations" },
      { label: "Evaluations", href: "/admin/evaluations", icon: ClipboardCheck, featureKey: "evaluations" },
      { label: "Evaluation Insights", href: "/admin/evaluations/insights", icon: PieChart, featureKey: "evaluations" },
      { label: "Ratings", href: "/admin/ratings", icon: Trophy, featureKey: "course_ratings" },
      { label: "Microlearning", href: "/admin/microlearning", icon: Puzzle, featureKey: "microlearning" },
      { label: "Nudges", href: "/admin/nudges", icon: Zap, featureKey: "nudges" },
    ],
    roles: ["admin", "super_admin"],
    bgClass: "bg-gray-800/60",
  },
  {
    // Platform administration — reserved for gC / GGS Super Admins. These manage
    // cross-organization concerns and are hidden from client Admins.
    header: "Platform",
    items: [
      { label: "Tenants", href: "/admin/tenants", icon: Globe },
      { label: "AI Course Creator", href: "/admin/courses/ai-create", icon: Wand2 },
      { label: "eCommerce", href: "/admin/ecommerce", icon: ShoppingCart },
      { label: "Storefronts", href: "/admin/storefronts", icon: Store },
      { label: "Catalog Import", href: "/admin/catalog-import", icon: FileText },
      { label: "Marketplace", href: "/admin/marketplace", icon: ShoppingBag },
      { label: "Predictive Analytics", href: "/admin/analytics/predictive", icon: BrainCircuit },
      { label: "xAPI / LRS", href: "/admin/settings/xapi", icon: Network },
      { label: "SSO", href: "/admin/settings/sso", icon: KeyRound },
      { label: "HRIS Integration", href: "/admin/settings/integrations/hris", icon: Link2 },
      { label: "Teams", href: "/admin/settings/integrations/teams", icon: MessageSquareMore },
    ],
    roles: ["super_admin"],
    bgClass: "bg-indigo-900/30",
  },
  // Settings always sits at the very bottom of the sidebar.
  {
    items: [{ label: "Settings", href: "/admin/settings", icon: Settings }],
    roles: ["admin", "super_admin"],
  },
];

const COLLAPSED_SECTIONS_KEY = "lms:sidebar:collapsed-sections";

interface SidebarProps {
  collapsed: boolean;
  /** When omitted (e.g. in the mobile overlay) the collapse toggle is hidden. */
  onToggle?: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [enabledFeatures, setEnabledFeatures] = useState<Record<string, boolean> | null>(null);

  const { user } = useAuth();
  const locale = useLocale();
  const currentRole: Role = (user?.role as Role) ?? "learner";

  // Restore per-section collapse preferences
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      if (stored) setCollapsedSections(JSON.parse(stored));
    } catch {
      // Ignore corrupt/unavailable storage
    }
  }, []);

  const toggleSection = (header: string) =>
    setCollapsedSections((prev) => {
      const next = { ...prev, [header]: !prev[header] };
      try {
        localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(next));
      } catch {
        // Ignore unavailable storage
      }
      return next;
    });

  // Load the effective feature flags for the current user (resolved against
  // their tenant, falling back to platform defaults).
  useEffect(() => {
    async function loadFeatures() {
      try {
        const res = await fetch("/api/features");
        if (res.ok) {
          const data = await res.json();
          setEnabledFeatures(data.features || {});
        }
      } catch {
        // Default to all enabled if features can't be loaded
      }
    }
    loadFeatures();
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-user-menu]')) setUserMenuOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [userMenuOpen]);

  const initials = user
    ? `${(user.first_name || "?")[0]}${(user.last_name || "?")[0]}`
    : "?";

  const filteredSections = useMemo(
    () =>
      navSections
        .filter((section) => section.roles.includes(currentRole))
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            // If no featureKey, always show
            if (!item.featureKey) return true;
            // If features haven't loaded yet, show everything (avoid flash of missing items)
            if (!enabledFeatures) return true;
            // Check if the feature is enabled (default to true if not explicitly disabled)
            return enabledFeatures[item.featureKey] !== false;
          }),
        }))
        .filter((section) => section.items.length > 0),
    [currentRole, enabledFeatures]
  );

  // Highlight only the most specific match so parent routes (e.g. /admin/settings)
  // don't light up alongside their children (e.g. /admin/settings/sso).
  const activeHref = useMemo(() => {
    let best = "";
    for (const section of filteredSections) {
      for (const item of section.items) {
        const matches =
          pathname === item.href || pathname.startsWith(item.href + "/");
        if (matches && item.href.length > best.length) best = item.href;
      }
    }
    return best;
  }, [filteredSections, pathname]);

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        "flex h-full flex-col bg-gray-900 text-white transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-800 bg-white px-3">
        {collapsed ? (
          <img src="/learnhub-icon.svg" alt="LearnHub" className="h-9 w-9 shrink-0" />
        ) : (
          <img src="/learnhub-logo.svg" alt="LearnHub" className="h-9 w-auto" />
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {filteredSections.map((section, sectionIdx) => {
          // Sections with a header are collapsible when the sidebar is expanded.
          const isCollapsible = !!section.header && !collapsed;
          const isSectionCollapsed = isCollapsible && !!collapsedSections[section.header!];

          return (
          <div
            key={section.header ?? sectionIdx}
            role="group"
            aria-label={section.header || "Main"}
            className={cn(
              section.header && !collapsed && "mt-3 rounded-lg px-1 py-1",
              section.header && !collapsed && section.bgClass
            )}
          >
            {section.header && !collapsed && (
              <button
                type="button"
                onClick={() => toggleSection(section.header!)}
                aria-expanded={!isSectionCollapsed}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                <span>{section.header}</span>
                {isSectionCollapsed ? (
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
              </button>
            )}
            {section.header && collapsed && (
              <div className="my-3 border-t border-gray-800" aria-hidden="true" />
            )}
            {!isSectionCollapsed && (
            <ul role="list" className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === activeHref;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-gray-900",
                        isActive
                          ? "bg-indigo-600/20 text-indigo-400"
                          : "text-gray-400 hover:bg-gray-800 hover:text-white"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          isActive ? "text-indigo-400" : "text-gray-500 group-hover:text-white"
                        )}
                        aria-hidden="true"
                      />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
            )}
          </div>
          );
        })}
      </nav>

      {/* User area */}
      <div className="border-t border-gray-800 p-3">
        <div className="relative" data-user-menu>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-label={`User menu, ${user ? `${user.first_name} ${user.last_name}` : "User"}`}
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-gray-800",
              "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-gray-900",
              collapsed && "justify-center"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold" aria-hidden="true">
              {initials}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">
                    {user ? `${user.first_name} ${user.last_name}` : "Loading..."}
                  </p>
                  <p className="text-xs text-gray-500">
                    {roleLabel(currentRole)}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
              </>
            )}
          </button>

          {userMenuOpen && (
            <div
              className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-xl"
              role="menu"
              aria-label="User menu"
            >
              <Link
                href="/profile"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white focus:outline-none"
                role="menuitem"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Profile
              </Link>
              <button
                onClick={async () => {
                  setUserMenuOpen(false);
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white focus:outline-none"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Language selector */}
      <div className="border-t border-gray-800 px-3 py-2">
        <LanguageSelector currentLocale={locale} compact={collapsed} />
      </div>

      {/* Collapse toggle */}
      {onToggle && (
        <div className="border-t border-gray-800 p-3">
          <button
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
