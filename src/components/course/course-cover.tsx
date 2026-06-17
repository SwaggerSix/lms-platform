import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { hasCoverImage } from "@/lib/courses/cover-image";

export interface CourseCoverProps {
  /** Stored cover image URL (courses.thumbnail_url). Empty → gradient fallback. */
  thumbnailUrl?: string | null;
  /** Course title — used as the image alt text (accessibility, WCAG 2.1 AA). */
  title: string;
  /**
   * Full Tailwind gradient classes for the fallback, including direction, e.g.
   * "bg-gradient-to-br from-blue-500 to-indigo-600". Used only when there is no
   * stored image.
   */
  gradientClassName?: string;
  /** Sizing / layout classes for the cover container (height, aspect, padding…). */
  className?: string;
  /**
   * Render a dark gradient scrim over the image so overlaid text stays legible.
   * Defaults to true; set false for covers that have no text on top of them.
   */
  scrim?: boolean;
  /** Overlaid content (badges, title, centered icon). Rendered above the image. */
  children?: ReactNode;
  /** Skip lazy loading (e.g. an above-the-fold hero). */
  eager?: boolean;
}

/**
 * Renders a course cover: the stored `thumbnailUrl` as a cover-fit `<img>` with
 * a subtle dark scrim for text contrast, or the gradient placeholder when no
 * image is stored. Any `children` (title, badges, icon) render on top.
 */
export function CourseCover({
  thumbnailUrl,
  title,
  gradientClassName,
  className,
  scrim = true,
  children,
  eager = false,
}: CourseCoverProps) {
  const showImage = hasCoverImage(thumbnailUrl);

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        !showImage && gradientClassName,
        className
      )}
    >
      {showImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> matches the rest of the codebase and works inside overlay layouts */}
          <img
            src={thumbnailUrl}
            alt={title}
            loading={eager ? "eager" : "lazy"}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {scrim && (
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10"
            />
          )}
        </>
      )}
      {children}
    </div>
  );
}

export default CourseCover;
