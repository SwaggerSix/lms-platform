"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, Download } from "lucide-react";
import { cn } from "@/utils/cn";
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl } from "@/lib/calendar-links";

interface AddToCalendarProps {
  title: string;
  /** Event start as an ISO string (absolute instant). */
  startISO: string;
  durationMinutes: number;
  description?: string;
  location?: string;
  /** URL to download an .ics file (Apple/iCal). */
  icsHref: string;
}

export default function AddToCalendar({
  title,
  startISO,
  durationMinutes,
  description,
  location,
  icsHref,
}: AddToCalendarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const event = { title, start, end, description, location };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <Calendar className="h-3.5 w-3.5" />
        Add to Calendar
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <a
            href={buildGoogleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-red-100 text-[10px] font-bold text-red-600">
              G
            </span>
            Google Calendar
          </a>
          <a
            href={buildOutlookCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-[10px] font-bold text-blue-600">
              O
            </span>
            Outlook
          </a>
          <a
            href={icsHref}
            download
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4 text-gray-500" />
            Apple Calendar (iCal)
          </a>
        </div>
      )}
    </div>
  );
}
