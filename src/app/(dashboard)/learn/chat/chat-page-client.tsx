"use client";

import { useState } from "react";
import { MessageSquare, BookOpen, ClipboardCheck, Briefcase } from "lucide-react";
import ChatWidget from "@/components/chat/chat-widget";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getHelp } from "@/lib/help-content";

interface ChatPageClientProps {
  userName: string;
  courses: { id: string; title: string }[];
}

const CONTEXT_OPTIONS = [
  { value: "general", label: "General Learning", icon: MessageSquare, color: "from-primary-500 to-purple-600" },
  { value: "course", label: "Course Help", icon: BookOpen, color: "from-blue-500 to-cyan-600" },
  { value: "assessment", label: "Assessment Prep", icon: ClipboardCheck, color: "from-emerald-500 to-teal-600" },
  { value: "career", label: "Career Guidance", icon: Briefcase, color: "from-amber-500 to-orange-600" },
] as const;

export default function ChatPageClient({ courses }: ChatPageClientProps) {
  const [contextType, setContextType] = useState<"general" | "course" | "assessment" | "career">("general");

  return (
    <div className="space-y-6 h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">AI Learning Assistant</h1>
            <InfoTooltip content={getHelp("learn.chat").details} label="About the AI Assistant" side="bottom" />
          </div>
          <p className="text-gray-500 mt-1">Get personalized help with your learning journey</p>
        </div>

        {/* Context Switcher */}
        <div className="flex gap-2">
          {CONTEXT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setContextType(opt.value)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all ${
                contextType === opt.value
                  ? "bg-primary-100 text-primary-700 font-medium ring-1 ring-primary-200"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <opt.icon className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Full-page chat */}
      <div className="h-[calc(100%-80px)] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <ChatWidget inline contextType={contextType} courses={courses} />
      </div>
    </div>
  );
}
