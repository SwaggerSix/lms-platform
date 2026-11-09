import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { hasPathImage } from "@/lib/paths/path-image";

export interface PathThumbnailProps {
  /** learning_paths.thumbnail_url. Empty → `fallback` is rendered instead. */
  url?: string | null;
  /** Path title — the image's alt text. */
  title: string;
  /** Sizing / shape classes for the container (e.g. "h-12 w-12 rounded-xl"). */
  className?: string;
  /** Extra classes applied only when there is no image (e.g. a gradient). */
  fallbackClassName?: string;
  /** What to show when the path has no image (an icon, usually). */
  fallback?: ReactNode;
  /** Skip lazy loading (an above-the-fold header). */
  eager?: boolean;
}

/**
 * A learning path's image, cover-fit into whatever box `className` sets, or the
 * fallback (icon / gradient) when the path has none.
 */
export function PathThumbnail({
  url,
  title,
  className,
  fallbackClassName,
  fallback,
  eager = false,
}: PathThumbnailProps) {
  if (!hasPathImage(url)) {
    return <div className={cn("overflow-hidden", className, fallbackClassName)}>{fallback}</div>;
  }
  return (
    <div className={cn("relative overflow-hidden bg-gray-100", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- plain <img>: values may be static /images paths or bucket URLs */}
      <img
        src={url}
        alt={title}
        loading={eager ? "eager" : "lazy"}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
