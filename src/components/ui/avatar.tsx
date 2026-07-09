"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cn } from "@/utils/cn";

const sizeClasses = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

const sizePx = {
  xs: 20,
  sm: 32,
  md: 40,
  lg: 56,
} as const;

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: keyof typeof sizeClasses;
  /** Overrides the default gray initials-circle background. Carry the text
   * color too (e.g. "bg-primary-100 text-primary-700" or a gradient with
   * "text-white"); the initials inherit it. */
  colorClass?: string;
}

function Avatar({ src, alt, fallback, size = "md", colorClass, className, ...props }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = src && !imgError;
  const dimension = sizePx[size];

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium",
        colorClass ?? "bg-gray-200 text-gray-600",
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
        <span className="uppercase">{fallback || "?"}</span>
      )}
    </div>
  );
}

export { Avatar };
