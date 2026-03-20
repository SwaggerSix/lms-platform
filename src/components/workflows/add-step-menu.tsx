"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Zap,
  Filter,
  Timer,
  GitBranch,
  Repeat,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/utils/cn";

type StepType = "condition" | "action" | "delay" | "branch" | "loop";

interface AddStepMenuProps {
  onAdd: (stepType: StepType, config?: Record<string, unknown>) => void;
}

const stepOptions: Array<{
  type: StepType;
  label: string;
  description: string;
  icon: typeof Zap;
  color: string;
  bg: string;
}> = [
  {
    type: "action",
    label: "Action",
    description: "Send email, enroll user, call webhook...",
    icon: Zap,
    color: "text-indigo-600",
    bg: "bg-indigo-50 hover:bg-indigo-100",
  },
  {
    type: "condition",
    label: "Condition",
    description: "Check a value and branch yes/no",
    icon: Filter,
    color: "text-amber-600",
    bg: "bg-amber-50 hover:bg-amber-100",
  },
  {
    type: "branch",
    label: "Branch",
    description: "Complex branching with multiple paths",
    icon: GitBranch,
    color: "text-purple-600",
    bg: "bg-purple-50 hover:bg-purple-100",
  },
  {
    type: "delay",
    label: "Delay",
    description: "Wait for a specified duration",
    icon: Timer,
    color: "text-sky-600",
    bg: "bg-sky-50 hover:bg-sky-100",
  },
  {
    type: "loop",
    label: "Loop",
    description: "Iterate over a list of items",
    icon: Repeat,
    color: "text-emerald-600",
    bg: "bg-emerald-50 hover:bg-emerald-100",
  },
];

export function AddStepMenu({ onAdd }: AddStepMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-30">
          <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Add Step
          </div>
          {stepOptions.map((opt) => (
            <button
              key={opt.type}
              onClick={() => {
                onAdd(opt.type);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                  opt.bg
                )}
              >
                <opt.icon className={cn("w-4.5 h-4.5", opt.color)} />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-800">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-lg transition-all text-sm font-medium",
          isOpen
            ? "bg-gray-700 text-white"
            : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-xl"
        )}
      >
        {isOpen ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Close
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            Add Step
          </>
        )}
      </button>
    </div>
  );
}
