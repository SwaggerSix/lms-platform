"use client";

import { useState, useEffect, useRef } from "react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  logo_url: string | null;
  membership_role?: string;
}

interface TenantSwitcherProps {
  currentTenantId?: string | null;
  onSwitch?: (tenant: Tenant) => void;
}

export function TenantSwitcher({ currentTenantId, onSwitch }: TenantSwitcherProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentTenant = tenants.find((t) => t.id === currentTenantId) || tenants[0];

  useEffect(() => {
    async function fetchTenants() {
      try {
        const res = await fetch("/api/tenants");
        const data = await res.json();
        if (res.ok) {
          setTenants(data.tenants || []);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchTenants();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-7 h-7 rounded-lg bg-gray-200 animate-pulse" />
        <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (tenants.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors w-full"
      >
        {currentTenant ? (
          <>
            {currentTenant.logo_url ? (
              <img
                src={currentTenant.logo_url}
                alt={currentTenant.name}
                className="w-7 h-7 rounded-lg object-cover"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: currentTenant.primary_color || "#4f46e5" }}
              >
                {currentTenant.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{currentTenant.name}</p>
              {currentTenant.membership_role && (
                <p className="text-xs text-gray-500 capitalize">{currentTenant.membership_role}</p>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        ) : (
          <span className="text-sm text-gray-500">Select tenant</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <p className="px-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Your Tenants
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => {
                  setOpen(false);
                  onSwitch?.(tenant);
                }}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                  tenant.id === currentTenant?.id
                    ? "bg-indigo-50"
                    : "hover:bg-gray-50"
                }`}
              >
                {tenant.logo_url ? (
                  <img
                    src={tenant.logo_url}
                    alt={tenant.name}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: tenant.primary_color || "#4f46e5" }}
                  >
                    {tenant.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{tenant.name}</p>
                  <p className="text-xs text-gray-500">{tenant.slug}.lms-platform.com</p>
                </div>
                {tenant.id === currentTenant?.id && (
                  <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          {tenants.length === 0 && (
            <div className="p-4 text-center text-sm text-gray-500">
              No tenants available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
