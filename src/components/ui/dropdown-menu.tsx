"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/utils/cn";

export interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: "left" | "right";
  className?: string;
  /** Accessible label for the menu */
  ariaLabel?: string;
}

function DropdownMenu({ trigger, items, align = "left", className, ariaLabel }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const enabledItems = items.map((item, i) => ({ ...item, index: i })).filter((item) => !item.disabled);

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
    // Return focus to trigger
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus the active menu item when focusedIndex changes
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && menuRef.current) {
      const buttons = menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
      const targetIdx = enabledItems.findIndex((item) => item.index === focusedIndex);
      if (targetIdx >= 0 && buttons[targetIdx]) {
        buttons[targetIdx].focus();
      }
    }
  }, [isOpen, focusedIndex, enabledItems]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        // Open on Enter, Space, ArrowDown
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setIsOpen(true);
          if (enabledItems.length > 0) {
            setFocusedIndex(enabledItems[0].index);
          }
        }
        return;
      }

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          close();
          break;
        case "ArrowDown": {
          e.preventDefault();
          const currentEnabledIdx = enabledItems.findIndex((item) => item.index === focusedIndex);
          const nextIdx = currentEnabledIdx < enabledItems.length - 1 ? currentEnabledIdx + 1 : 0;
          setFocusedIndex(enabledItems[nextIdx].index);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const currentEnabledIdx2 = enabledItems.findIndex((item) => item.index === focusedIndex);
          const prevIdx = currentEnabledIdx2 > 0 ? currentEnabledIdx2 - 1 : enabledItems.length - 1;
          setFocusedIndex(enabledItems[prevIdx].index);
          break;
        }
        case "Home":
          e.preventDefault();
          if (enabledItems.length > 0) setFocusedIndex(enabledItems[0].index);
          break;
        case "End":
          e.preventDefault();
          if (enabledItems.length > 0) setFocusedIndex(enabledItems[enabledItems.length - 1].index);
          break;
        case "Tab":
          close();
          break;
      }
    },
    [isOpen, focusedIndex, enabledItems, close]
  );

  return (
    <div ref={ref} className={cn("relative inline-block", className)} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setIsOpen((prev) => {
            if (!prev && enabledItems.length > 0) {
              setFocusedIndex(enabledItems[0].index);
            }
            return !prev;
          });
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="cursor-pointer"
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            "absolute z-50 mt-1 min-w-[180px] rounded-md border border-gray-200 bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
          role="menu"
          aria-label={ariaLabel}
        >
          {items.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={item.disabled}
              tabIndex={focusedIndex === i ? 0 : -1}
              onClick={() => {
                item.onClick();
                close();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                "hover:bg-gray-100 focus:bg-gray-100 focus:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-50",
                item.destructive
                  ? "text-red-600 hover:bg-red-50 focus:bg-red-50"
                  : "text-gray-700"
              )}
            >
              {item.icon && <span className="h-4 w-4 shrink-0" aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { DropdownMenu };
