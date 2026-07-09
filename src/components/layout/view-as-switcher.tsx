"use client";

import { Eye, Check, LogOut } from "lucide-react";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { roleLabel } from "@/lib/auth/roles";
import { useViewAs } from "@/hooks/use-view-as";

/**
 * Header control that lets Admins / Super Admins preview the app as another
 * role (read-only). Hidden for everyone else. See §2.12 and use-view-as.ts.
 */
export default function ViewAsSwitcher() {
  const {
    canUseViewAs,
    previewableRoles,
    viewingAs,
    isPreviewing,
    pending,
    startPreview,
    exitPreview,
  } = useViewAs();

  if (!canUseViewAs || previewableRoles.length === 0) return null;

  const items: DropdownMenuItem[] = previewableRoles.map((role) => ({
    label: roleLabel(role),
    icon:
      viewingAs === role ? (
        <Check className="h-4 w-4 text-primary-600" />
      ) : (
        <Eye className="h-4 w-4" />
      ),
    disabled: pending || viewingAs === role,
    onClick: () => startPreview(role),
  }));

  if (isPreviewing) {
    items.push({
      label: "Exit preview",
      icon: <LogOut className="h-4 w-4" />,
      destructive: true,
      disabled: pending,
      onClick: () => exitPreview(),
    });
  }

  return (
    <DropdownMenu
      align="right"
      ariaLabel="View the app as another role"
      trigger={
        <span
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2"
          title="View as another role"
        >
          <Eye className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {isPreviewing ? `Viewing as ${roleLabel(viewingAs)}` : "View as"}
          </span>
        </span>
      }
      items={items}
    />
  );
}
