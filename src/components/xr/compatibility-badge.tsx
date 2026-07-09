import React from "react";
import { Monitor, Smartphone, Headset } from "lucide-react";

interface CompatibilityBadgeProps {
  compatibility: string[];
  size?: "sm" | "md";
}

const deviceIcons: Record<string, { label: string; icon: React.ReactNode }> = {
  desktop: {
    label: "Desktop",
    icon: <Monitor className="w-full h-full" strokeWidth={1.5} />,
  },
  mobile: {
    label: "Mobile",
    icon: <Smartphone className="w-full h-full" strokeWidth={1.5} />,
  },
  headset: {
    label: "VR Headset",
    icon: <Headset className="w-full h-full" strokeWidth={1.5} />,
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
