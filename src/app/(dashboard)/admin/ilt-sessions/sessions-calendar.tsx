"use client";

import { useMemo } from "react";
import { cn } from "@/utils/cn";
import { STATUS_CONFIG, type SessionItem } from "./sessions-shared";

interface SessionsCalendarProps {
  sessions: SessionItem[];
  onSelect: (session: SessionItem) => void;
}

export default function SessionsCalendar({ sessions, onSelect }: SessionsCalendarProps) {
  const calendarMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = firstDay.getDay();
    const days: { date: number; sessions: SessionItem[] }[] = [];

    for (let i = 0; i < startDay; i++) {
      days.push({ date: 0, sessions: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const daySessions = sessions.filter((s) => s.session_date === dateStr);
      days.push({ date: d, sessions: daySessions });
    }
    return { days, label: firstDay.toLocaleString("default", { month: "long", year: "numeric" }), today: now.getDate() };
  }, [sessions]);

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-center font-semibold text-gray-900">
        {calendarMonth.label}
      </div>
      <div className="grid grid-cols-7">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="border-b border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs font-medium text-gray-500">
            {d}
          </div>
        ))}
        {calendarMonth.days.map((day, idx) => (
          <div
            key={idx}
            className={cn(
              "min-h-[80px] border-b border-r border-gray-100 p-1",
              day.date === 0 && "bg-gray-50"
            )}
          >
            {day.date > 0 && (
              <>
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    day.date === calendarMonth.today ? "bg-primary-600 text-white" : "text-gray-700"
                  )}
                >
                  {day.date}
                </span>
                <div className="mt-1 space-y-0.5">
                  {day.sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onSelect(s)}
                      className={cn(
                        "block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium",
                        STATUS_CONFIG[s.status].color
                      )}
                      title={s.title}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
