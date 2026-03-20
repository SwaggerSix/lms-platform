import React from "react";

interface CompatibilityBadgeProps {
  compatibility: string[];
  size?: "sm" | "md";
}

const deviceIcons: Record<string, { label: string; icon: React.ReactNode }> = {
  desktop: {
    label: "Desktop",
    icon: (
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
      </svg>
    ),
  },
  mobile: {
    label: "Mobile",
    icon: (
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
  },
  headset: {
    label: "VR Headset",
    icon: (
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h17.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125H3.375A1.125 1.125 0 012.25 16.875v-9.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M7.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      </svg>
    ),
  },
};

const allDevices = ["desktop", "mobile", "headset"];

export default function CompatibilityBadge({ compatibility, size = "sm" }: CompatibilityBadgeProps) {
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const containerPadding = size === "sm" ? "px-2 py-1" : "px-3 py-1.5";

  return (
    <div className={`inline-flex items-center gap-1.5 ${containerPadding} bg-gray-50 rounded-lg border border-gray-100`}>
      {allDevices.map((device) => {
        const isSupported = compatibility.includes(device);
        const info = deviceIcons[device];
        if (!info) return null;

        return (
          <div
            key={device}
            title={`${info.label}: ${isSupported ? "Supported" : "Not supported"}`}
            className={`${iconSize} transition-colors ${
              isSupported ? "text-green-600" : "text-gray-300"
            }`}
          >
            {info.icon}
          </div>
        );
      })}
    </div>
  );
}
