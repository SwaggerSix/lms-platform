"use client";

import { type ContentBlock } from "@/lib/content/block-editor";
import BlockRenderer from "./block-renderer";

interface ContentViewerProps {
  blocks: ContentBlock[];
}

export default function ContentViewer({ blocks }: ContentViewerProps) {
  if (blocks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-400">No content available for this lesson yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {blocks.map((block) => (
        <div key={block.id}>
          <BlockRenderer block={block} editable={false} />
        </div>
      ))}
    </div>
  );
}
