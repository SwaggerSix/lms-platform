"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cn } from "@/utils/cn";

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

const sizePx = {
  sm: 32,
  md: 40,
  lg: 56,
} as const;

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
}

function Avatar({ src, alt, fallback, size = "md", className, ...props }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = src && !imgError;
  const dimension = sizePx[size];

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {showImage ? (
        <Image
          src={src}
          alt={alt || ""}
          width={dimension}
          height={dimension}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="font-medium text-gray-600 uppercase">
          {fallback || "?"}
        </span>
      )}
    </div>
  );
}

export { Avatar };
