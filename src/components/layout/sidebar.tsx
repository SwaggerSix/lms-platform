"use client";

import { useState, useEffect } from "react";
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
  Users,
  ClipboardList,
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
  ScrollText,
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
  KeyRound,
  Zap,
  ShoppingCart,
  Bot,
  Heart,
  Microscope,
  Puzzle,
  Store,
  BrainCircuit,
  Network,
  Globe,
  Eye,
  Workflow,
  Headset,
  Link2,
  TrendingUp,
  MessageSquareMore,
} from "lucide-react";
import { useLocale } from "next-intl";
import LanguageSelector from "@/components/ui/language-selector";

type Role = "learner" | "manager" | "admin" | "super_admin";

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
}

// All nav sections including new features
const navSections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
    roles: ["learner", "manager", "admin", "super_admin"],
  },
  {
    items: [
      { label: "Course Catalog", href: "/learn/catalog", icon: BookOpen },
      { label: "My Courses", href: "/learn/my-courses", icon: Library },
      { label: "Learning Paths", href: "/learn/paths", icon: Route },
      { label: "Certifications", href: "/learn/certifications", icon: Award },
      { label: "Achievements", href: "/learn/achievements", icon: Trophy, featureKey: "gamification" },
      { label: "Discussions", href: "/learn/discussions", icon: MessageSquare, featureKey: "social_learning" },
      { label: "Messages", href: "/learn/messages", icon: Mail, featureKey: "social_learning" },
      { label: "Documents", href: "/learn/documents", icon: FolderOpen },
      { label: "Knowledge Base", href: "/learn/knowledge-base", icon: HelpCircle },
      { label: "ILT Sessions", href: "/learn/ilt-sessions", icon: CalendarDays, featureKey: "ilt_sessions" },
      { label: "Transcript", href: "/learn/transcript", icon: FileText },
      { label: "Shop", href: "/shop", icon: ShoppingCart, featureKey: "ecommerce" },
      { label: "AI Chat", href: "/learn/chat", icon: Bot, featureKey: "ai_chat" },
      { label: "Mentorship", href: "/learn/mentorship", icon: Heart, featureKey: "mentorship" },
      { label: "Microlearning", href: "/learn/microlearning", icon: Puzzle, featureKey: "microlearning" },
      { label: "Marketplace", href: "/learn/marketplace", icon: Store, featureKey: "marketplace" },
      { label: "360 Feedback", href: "/learn/feedback", icon: MessageSquare, featureKey: "feedback_360" },
      { label: "Observations", href: "/learn/observations", icon: Eye, featureKey: "observations" },
      { label: "Evaluations", href: "/learn/evaluations", icon: ClipboardList, featureKey: "evaluations" },
    ],
    roles: ["learner", "manager", "admin", "super_admin"],
  },
  {
    header: "MANAGEMENT",
    items: [
      { label: "My Team", href: "/manager/team", icon: Users },
      { label: "Approvals", href: "/manager/approvals", icon: CheckSquare },
      { label: "Assignments", href: "/manager/assignments", icon: ClipboardList },
      { label: "Compliance", href: "/manager/compliance", icon: ShieldCheck },
      { label: "Team Skills", href: "/manager/skills", icon: BarChart3 },
      { label: "Team Analytics", href: "/manager/analytics", icon: TrendingUp },
    ],
    roles: ["manager", "admin", "super_admin"],
  },
  {
    header: "ADMINISTRATION",
    items: [
      { label: "Users", href: "/admin/users", icon: UserCog },
      { label: "Organizations", href: "/admin/organizations", icon: Building2 },
      { label: "Courses", href: "/admin/courses", icon: GraduationCap },
      { label: "AI Course Creator", href: "/admin/courses/ai-create", icon: Sparkles },
      { label: "ILT Sessions", href: "/admin/ilt-sessions", icon: CalendarDays },
      { label: "Learning Paths", href: "/admin/paths", icon: GitBranch },
      { label: "Assessments", href: "/admin/assessments", icon: FileQuestion },
      { label: "Certifications", href: "/admin/certifications", icon: Medal },
      { label: "Compliance", href: "/admin/compliance", icon: Scale },
      { label: "Approvals", href: "/admin/approvals", icon: CheckSquare },
      { label: "Skills", href: "/admin/skills", icon: Sparkles },
      { label: "Gamification", href: "/admin/gamification", icon: Gamepad2 },
      { label: "Documents", href: "/admin/documents", icon: FolderOpen },
      { label: "Knowledge Base", href: "/admin/knowledge-base", icon: HelpCircle },
      { label: "Automation", href: "/admin/automation", icon: Zap },
      { label: "Reports", href: "/admin/reports", icon: PieChart },
      { label: "Scheduled Reports", href: "/admin/scheduled-reports", icon: Clock },
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "SSO", href: "/admin/settings/sso", icon: KeyRound },
      { label: "Audit Log", href: "/admin/audit-log", icon: ScrollText },
      { label: "Workflows", href: "/admin/workflows", icon: Workflow },
      { label: "360 Feedback", href: "/admin/feedback", icon: MessageSquare },
      { label: "Mentorship", href: "/admin/mentorship", icon: Heart },
      { label: "Observations", href: "/admin/observations", icon: Eye },
      { label: "Evaluations", href: "/admin/evaluations", icon: ClipboardList },
      { label: "Microlearning", href: "/admin/microlearning", icon: Puzzle },
      { label: "Marketplace", href: "/admin/marketplace", icon: Store },
      { label: "Tenants", href: "/admin/tenants", icon: Globe },
      { label: "eCommerce", href: "/admin/ecommerce", icon: ShoppingCart },
      { label: "Predictive Analytics", href: "/admin/analytics/predictive", icon: BrainCircuit },
      { label: "xAPI / LRS", href: "/admin/settings/xapi", icon: Network },
      { label: "HRIS Integration", href: "/admin/settings/integrations/hris", icon: Link2 },
      { label: "Teams", href: "/admin/settings/integrations/teams", icon: MessageSquareMore },
    ],
    roles: ["admin", "super_admin"],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [enabledFeatures, setEnabledFeatures] = useState<Record<string, boolean> | null>(null);
  const { user } = useAuth();
  const locale = useLocale();
  const currentRole: Role = (user?.role as Role) ?? "learner";

  // Load feature flags from platform settings
  useEffect(() => {
    async function loadFeatures() {
      try {
        const res = await fetch("/api/settings?key=features");
        if (res.ok) {
          const data = await res.json();
          setEnabledFeatures(data.value || {});
        }
      } catch {
        // Default to all enabled if settings can't be loaded
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

  const filteredSections = navSections
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
    .filter((section) => section.items.length > 0);

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        "flex h-full flex-col bg-gray-900 text-white transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-800 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600" aria-hidden="true">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight">LearnHub</span>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {filteredSections.map((section, sectionIdx) => (
          <div key={sectionIdx} role="group" aria-label={section.header || "Main"}>
            {section.header && !collapsed && (
              <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500" aria-hidden="true">
                {section.header}
              </p>
            )}
            {section.header && collapsed && (
              <div className="my-3 border-t border-gray-800" aria-hidden="true" />
            )}
            <ul role="list" className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

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
          </div>
        ))}
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
                  <p className="text-xs capitalize text-gray-500">
                    {currentRole.replace("_", " ")}
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
    </aside>
  );
}
