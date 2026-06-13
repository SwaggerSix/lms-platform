"use client";

import { useState } from "react";

// Product image gallery: a large active image plus thumbnails. Falls back to a
// branded letter tile when a product has no images.
export function ProductGallery({
  images,
  fallbackLetter,
  alt,
}: {
  images: string[];
  fallbackLetter: string;
  alt: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="rounded-2xl overflow-hidden bg-slate-100 aspect-[16/11]">
        <div
          className="h-full w-full flex items-center justify-center text-6xl font-bold text-white/90"
          style={{ backgroundColor: "var(--store-primary)" }}
        >
          {fallbackLetter}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl overflow-hidden bg-slate-100 aspect-[16/11]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[active]} alt={alt} className="h-full w-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`h-16 w-20 rounded-lg overflow-hidden border-2 transition-colors ${
                i === active ? "border-[color:var(--store-primary)]" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
