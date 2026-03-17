"use client";

import { useState, useEffect } from "react";
import { cn } from "@/utils/cn";
import Sidebar from "./sidebar";
import Header from "./header";
import { X } from "lucide-react";
import { SkipLink } from "@/components/ui/skip-link";
import { LiveRegion } from "@/components/ui/live-region";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <SkipLink />
      <LiveRegion />
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 flex lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-50 flex">
              <Sidebar
                collapsed={false}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                onClose={() => setMobileOpen(false)}
              />
              <button
                onClick={() => setMobileOpen(false)}
                className="ml-1 mt-3 rounded-full bg-gray-900/80 p-1.5 text-white hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onMenuToggle={() => setMobileOpen(!mobileOpen)} />
          <main
            id="main-content"
            className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
