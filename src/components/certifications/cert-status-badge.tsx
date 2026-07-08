"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/utils/cn";
import type { CertStatus } from "@/lib/certifications/status";

/** One badge for certification status everywhere certs render
 * (certifications page, profile). */
export function CertStatusBadge({ status }: { status: CertStatus }) {
  const config = {
    active: { label: "Active", icon: CheckCircle2, className: "bg-green-100 text-green-700" },
    expiring_soon: { label: "Expiring Soon", icon: AlertTriangle, className: "bg-yellow-100 text-yellow-700" },
    expired: { label: "Expired", icon: XCircle, className: "bg-red-100 text-red-700" },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", c.className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {c.label}
    </span>
  );
}
