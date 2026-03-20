"use client";

import { useState } from "react";
import ChatWidget from "@/components/chat/chat-widget";

interface ChatPageClientProps {
  userName: string;
}

const CONTEXT_OPTIONS = [
  { value: "general", label: "General Learning", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z", color: "from-indigo-500 to-purple-600" },
  { value: "course", label: "Course Help", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", color: "from-blue-500 to-cyan-600" },
  { value: "assessment", label: "Assessment Prep", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", color: "from-emerald-500 to-teal-600" },
  { value: "career", label: "Career Guidance", icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", color: "from-amber-500 to-orange-600" },
] as const;

export default function ChatPageClient({ userName }: ChatPageClientProps) {
  const [contextType, setContextType] = useState<"general" | "course" | "assessment" | "career">("general");

  return (
    <div className="space-y-6 h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Learning Assistant</h1>
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
                  ? "bg-indigo-100 text-indigo-700 font-medium ring-1 ring-indigo-200"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={opt.icon} />
              </svg>
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Full-page chat */}
      <div className="h-[calc(100%-80px)] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <ChatWidget inline contextType={contextType} />
      </div>
    </div>
  );
}
