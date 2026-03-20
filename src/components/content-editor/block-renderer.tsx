"use client";

import { useState, useMemo } from "react";
import DOMPurify from "dompurify";
import {
  type ContentBlock,
  type TextBlock,
  type HeadingBlock,
  type ImageBlock,
  type VideoBlock,
  type CodeBlock,
  type EmbedBlock,
  type QuizInlineBlock,
  type DividerBlock,
  type CalloutBlock,
  type AccordionBlock,
  type TabsBlock,
} from "@/lib/content/block-editor";
import { v4 as uuidv4 } from "uuid";

/** Only allow http/https URLs for iframes to prevent javascript: URI injection */
function isSafeUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

interface BlockRendererProps {
  block: ContentBlock;
  editable?: boolean;
  onUpdate?: (block: ContentBlock) => void;
}

// -- Text Block --
function TextBlockEditor({ block, editable, onUpdate }: { block: TextBlock; editable?: boolean; onUpdate?: (b: TextBlock) => void }) {
  const sanitizedHtml = useMemo(() => DOMPurify.sanitize(block.content.html), [block.content.html]);
  if (!editable) {
    return <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
  }
  return (
    <div
      className="prose prose-gray max-w-none focus:outline-none min-h-[1.5em]"
      contentEditable
      suppressContentEditableWarning
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      onBlur={(e) => {
        onUpdate?.({ ...block, content: { html: e.currentTarget.innerHTML } });
      }}
    />
  );
}

// -- Heading Block --
function HeadingBlockEditor({ block, editable, onUpdate }: { block: HeadingBlock; editable?: boolean; onUpdate?: (b: HeadingBlock) => void }) {
  const sizeClasses: Record<number, string> = {
    1: "text-3xl font-bold",
    2: "text-2xl font-semibold",
    3: "text-xl font-semibold",
    4: "text-lg font-medium",
  };

  const headingClass = `${sizeClasses[block.content.level]} text-gray-900`;

  if (!editable) {
    switch (block.content.level) {
      case 1: return <h1 className={headingClass}>{block.content.text}</h1>;
      case 2: return <h2 className={headingClass}>{block.content.text}</h2>;
      case 3: return <h3 className={headingClass}>{block.content.text}</h3>;
      case 4: return <h4 className={headingClass}>{block.content.text}</h4>;
      default: return <h2 className={headingClass}>{block.content.text}</h2>;
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={block.content.level}
        onChange={(e) =>
          onUpdate?.({ ...block, content: { ...block.content, level: parseInt(e.target.value) as 1 | 2 | 3 | 4 } })
        }
        className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-500 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value={1}>H1</option>
        <option value={2}>H2</option>
        <option value={3}>H3</option>
        <option value={4}>H4</option>
      </select>
      <input
        type="text"
        value={block.content.text}
        onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, text: e.target.value } })}
        className={`${sizeClasses[block.content.level]} text-gray-900 flex-1 bg-transparent border-none focus:outline-none focus:ring-0 p-0`}
        placeholder="Enter heading..."
      />
    </div>
  );
}

// -- Image Block --
function ImageBlockEditor({ block, editable, onUpdate }: { block: ImageBlock; editable?: boolean; onUpdate?: (b: ImageBlock) => void }) {
  if (!editable) {
    if (!block.content.url) return null;
    return (
      <figure>
        <img src={block.content.url} alt={block.content.alt} className="rounded-lg max-w-full" />
        {block.content.caption && (
          <figcaption className="mt-2 text-sm text-gray-500 text-center">{block.content.caption}</figcaption>
        )}
      </figure>
    );
  }

  return (
    <div className="space-y-3">
      {block.content.url ? (
        <img src={block.content.url} alt={block.content.alt} className="rounded-lg max-w-full max-h-96 object-contain" />
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
          <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <p className="text-sm text-gray-400">Paste an image URL below</p>
        </div>
      )}
      <input
        type="url"
        value={block.content.url}
        onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, url: e.target.value } })}
        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Image URL..."
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={block.content.alt}
          onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, alt: e.target.value } })}
          className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Alt text..."
        />
        <input
          type="text"
          value={block.content.caption || ""}
          onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, caption: e.target.value } })}
          className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Caption (optional)..."
        />
      </div>
    </div>
  );
}

// -- Video Block --
function VideoBlockEditor({ block, editable, onUpdate }: { block: VideoBlock; editable?: boolean; onUpdate?: (b: VideoBlock) => void }) {
  const getEmbedUrl = (url: string) => {
    if (!url) return "";
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return url;
  };

  const embedUrl = getEmbedUrl(block.content.url);

  if (!editable) {
    if (!embedUrl || !isSafeUrl(embedUrl)) return null;
    return (
      <figure>
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
          <iframe src={embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen frameBorder="0" sandbox="allow-scripts allow-same-origin allow-popups" />
        </div>
        {block.content.caption && (
          <figcaption className="mt-2 text-sm text-gray-500 text-center">{block.content.caption}</figcaption>
        )}
      </figure>
    );
  }

  return (
    <div className="space-y-3">
      {embedUrl ? (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
          <iframe src={embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen frameBorder="0" />
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
          <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <p className="text-sm text-gray-400">Paste a YouTube or Vimeo URL</p>
        </div>
      )}
      <input
        type="url"
        value={block.content.url}
        onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, url: e.target.value } })}
        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Video URL (YouTube, Vimeo)..."
      />
    </div>
  );
}

// -- Code Block --
function CodeBlockEditor({ block, editable, onUpdate }: { block: CodeBlock; editable?: boolean; onUpdate?: (b: CodeBlock) => void }) {
  const languages = ["javascript", "typescript", "python", "html", "css", "json", "bash", "sql", "java", "go", "rust", "php", "ruby", "csharp"];

  if (!editable) {
    return (
      <div className="rounded-lg overflow-hidden">
        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-mono">{block.content.language}</span>
        </div>
        <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto text-sm font-mono">
          <code>{block.content.code}</code>
        </pre>
        {block.content.caption && (
          <p className="mt-1 text-sm text-gray-500 text-center">{block.content.caption}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <select
          value={block.content.language}
          onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, language: e.target.value } })}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {languages.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={block.content.showLineNumbers ?? true}
            onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, showLineNumbers: e.target.checked } })}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Line numbers
        </label>
      </div>
      <textarea
        value={block.content.code}
        onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, code: e.target.value } })}
        rows={8}
        className="w-full font-mono text-sm bg-gray-900 text-gray-100 p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        placeholder="Paste your code here..."
        spellCheck={false}
      />
    </div>
  );
}

// -- Embed Block --
function EmbedBlockEditor({ block, editable, onUpdate }: { block: EmbedBlock; editable?: boolean; onUpdate?: (b: EmbedBlock) => void }) {
  if (!editable) {
    if (!block.content.url || !isSafeUrl(block.content.url)) return null;
    return (
      <div className="rounded-lg overflow-hidden" style={{ height: block.content.height || 400 }}>
        <iframe src={block.content.url} className="w-full h-full" frameBorder="0" allowFullScreen sandbox="allow-scripts allow-same-origin allow-popups" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {block.content.url ? (
        <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: block.content.height || 400 }}>
          <iframe src={block.content.url} className="w-full h-full" frameBorder="0" allowFullScreen />
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
          <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
          </svg>
          <p className="text-sm text-gray-400">Enter a URL to embed</p>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="url"
          value={block.content.url}
          onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, url: e.target.value } })}
          className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Embed URL..."
        />
        <input
          type="number"
          value={block.content.height || 400}
          onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, height: parseInt(e.target.value) || 400 } })}
          className="w-24 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Height"
        />
      </div>
    </div>
  );
}

// -- Quiz Inline Block --
function QuizInlineBlockEditor({ block, editable, onUpdate }: { block: QuizInlineBlock; editable?: boolean; onUpdate?: (b: QuizInlineBlock) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  if (!editable) {
    const correctOption = block.content.options.find((o) => o.isCorrect);
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5">
        <p className="font-medium text-gray-900 mb-3">{block.content.question}</p>
        <div className="space-y-2">
          {block.content.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { setSelectedId(opt.id); setShowAnswer(true); }}
              className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                showAnswer && opt.isCorrect
                  ? "border-green-300 bg-green-50 text-green-800"
                  : showAnswer && selectedId === opt.id && !opt.isCorrect
                  ? "border-red-300 bg-red-50 text-red-800"
                  : selectedId === opt.id
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-indigo-200"
              }`}
            >
              {opt.text}
            </button>
          ))}
        </div>
        {showAnswer && block.content.explanation && (
          <p className="mt-3 text-sm text-gray-600 bg-white rounded-lg p-3 border border-gray-200">
            {block.content.explanation}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 space-y-3">
      <input
        type="text"
        value={block.content.question}
        onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, question: e.target.value } })}
        className="w-full text-sm font-medium px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Enter question..."
      />
      <div className="space-y-2">
        {block.content.options.map((opt, i) => (
          <div key={opt.id} className="flex items-center gap-2">
            <input
              type="radio"
              checked={opt.isCorrect}
              onChange={() => {
                const newOptions = block.content.options.map((o) => ({ ...o, isCorrect: o.id === opt.id }));
                onUpdate?.({ ...block, content: { ...block.content, options: newOptions } });
              }}
              className="text-indigo-600 focus:ring-indigo-500"
              title="Mark as correct"
            />
            <input
              type="text"
              value={opt.text}
              onChange={(e) => {
                const newOptions = [...block.content.options];
                newOptions[i] = { ...newOptions[i], text: e.target.value };
                onUpdate?.({ ...block, content: { ...block.content, options: newOptions } });
              }}
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={`Option ${i + 1}...`}
            />
            {block.content.options.length > 2 && (
              <button
                onClick={() => {
                  const newOptions = block.content.options.filter((_, j) => j !== i);
                  onUpdate?.({ ...block, content: { ...block.content, options: newOptions } });
                }}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          const newOptions = [...block.content.options, { id: uuidv4(), text: "", isCorrect: false }];
          onUpdate?.({ ...block, content: { ...block.content, options: newOptions } });
        }}
        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
      >
        + Add option
      </button>
      <input
        type="text"
        value={block.content.explanation || ""}
        onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, explanation: e.target.value } })}
        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Explanation (shown after answering)..."
      />
    </div>
  );
}

// -- Divider Block --
function DividerBlockEditor({ block, editable, onUpdate }: { block: DividerBlock; editable?: boolean; onUpdate?: (b: DividerBlock) => void }) {
  const styleMap: Record<string, string> = {
    solid: "border-solid",
    dashed: "border-dashed",
    dotted: "border-dotted",
    gradient: "border-none",
  };

  return (
    <div className="py-2">
      {block.content.style === "gradient" ? (
        <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
      ) : (
        <hr className={`border-t border-gray-200 ${styleMap[block.content.style]}`} />
      )}
      {editable && (
        <div className="flex justify-center mt-2">
          <select
            value={block.content.style}
            onChange={(e) => onUpdate?.({ ...block, content: { style: e.target.value as DividerBlock["content"]["style"] } })}
            className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-500 bg-white focus:outline-none"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
            <option value="gradient">Gradient</option>
          </select>
        </div>
      )}
    </div>
  );
}

// -- Callout Block --
function CalloutBlockEditor({ block, editable, onUpdate }: { block: CalloutBlock; editable?: boolean; onUpdate?: (b: CalloutBlock) => void }) {
  const variants: Record<string, { bg: string; border: string; icon: string; text: string }> = {
    info: { bg: "bg-blue-50", border: "border-blue-200", icon: "i", text: "text-blue-800" },
    warning: { bg: "bg-amber-50", border: "border-amber-200", icon: "!", text: "text-amber-800" },
    success: { bg: "bg-green-50", border: "border-green-200", icon: "\u2713", text: "text-green-800" },
    error: { bg: "bg-red-50", border: "border-red-200", icon: "\u2717", text: "text-red-800" },
    tip: { bg: "bg-purple-50", border: "border-purple-200", icon: "\u2605", text: "text-purple-800" },
  };

  const v = variants[block.content.variant] || variants.info;

  if (!editable) {
    return (
      <div className={`${v.bg} ${v.border} border rounded-lg p-4 flex gap-3`}>
        <span className={`${v.text} text-lg font-bold flex-shrink-0 w-6 h-6 flex items-center justify-center`}>
          {v.icon}
        </span>
        <div className="flex-1">
          {block.content.title && <p className={`font-semibold ${v.text} mb-1`}>{block.content.title}</p>}
          <p className={`${v.text} text-sm`}>{block.content.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${v.bg} ${v.border} border rounded-lg p-4 space-y-2`}>
      <div className="flex items-center gap-2">
        <select
          value={block.content.variant}
          onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, variant: e.target.value as CalloutBlock["content"]["variant"] } })}
          className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white focus:outline-none"
        >
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="tip">Tip</option>
        </select>
        <input
          type="text"
          value={block.content.title || ""}
          onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, title: e.target.value } })}
          className="flex-1 text-sm font-medium px-2 py-1 bg-white/60 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Title (optional)..."
        />
      </div>
      <textarea
        value={block.content.text}
        onChange={(e) => onUpdate?.({ ...block, content: { ...block.content, text: e.target.value } })}
        rows={2}
        className="w-full text-sm px-3 py-2 bg-white/60 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        placeholder="Callout text..."
      />
    </div>
  );
}

// -- Accordion Block --
function AccordionBlockEditor({ block, editable, onUpdate }: { block: AccordionBlock; editable?: boolean; onUpdate?: (b: AccordionBlock) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!editable) {
    return (
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 overflow-hidden">
        {block.content.items.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => setOpenId(openId === item.id ? null : item.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900 text-sm">{item.title}</span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${openId === item.id ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
              </svg>
            </button>
            {openId === item.id && (
              <div className="px-4 pb-3 text-sm text-gray-600">{item.body}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {block.content.items.map((item, i) => (
        <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={item.title}
              onChange={(e) => {
                const newItems = [...block.content.items];
                newItems[i] = { ...newItems[i], title: e.target.value };
                onUpdate?.({ ...block, content: { items: newItems } });
              }}
              className="flex-1 text-sm font-medium px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Section title..."
            />
            {block.content.items.length > 1 && (
              <button
                onClick={() => {
                  const newItems = block.content.items.filter((_, j) => j !== i);
                  onUpdate?.({ ...block, content: { items: newItems } });
                }}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <textarea
            value={item.body}
            onChange={(e) => {
              const newItems = [...block.content.items];
              newItems[i] = { ...newItems[i], body: e.target.value };
              onUpdate?.({ ...block, content: { items: newItems } });
            }}
            rows={2}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            placeholder="Section content..."
          />
        </div>
      ))}
      <button
        onClick={() => {
          const newItems = [...block.content.items, { id: uuidv4(), title: "", body: "" }];
          onUpdate?.({ ...block, content: { items: newItems } });
        }}
        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
      >
        + Add section
      </button>
    </div>
  );
}

// -- Tabs Block --
function TabsBlockEditor({ block, editable, onUpdate }: { block: TabsBlock; editable?: boolean; onUpdate?: (b: TabsBlock) => void }) {
  const [activeTab, setActiveTab] = useState(block.content.tabs[0]?.id || "");

  if (!editable) {
    return (
      <div>
        <div className="flex border-b border-gray-200">
          {block.content.tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-4 text-sm text-gray-700">
          {block.content.tabs.find((t) => t.id === activeTab)?.body}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        {block.content.tabs.map((tab, i) => (
          <div
            key={tab.id}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
              activeTab === tab.id ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <input
              type="text"
              value={tab.label}
              onChange={(e) => {
                const newTabs = [...block.content.tabs];
                newTabs[i] = { ...newTabs[i], label: e.target.value };
                onUpdate?.({ ...block, content: { tabs: newTabs } });
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent border-none focus:outline-none text-sm font-medium w-20 p-0"
              placeholder="Tab label"
            />
            {block.content.tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newTabs = block.content.tabs.filter((_, j) => j !== i);
                  if (activeTab === tab.id && newTabs.length > 0) setActiveTab(newTabs[0].id);
                  onUpdate?.({ ...block, content: { tabs: newTabs } });
                }}
                className="text-gray-400 hover:text-red-500"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => {
            const newTab = { id: uuidv4(), label: `Tab ${block.content.tabs.length + 1}`, body: "" };
            onUpdate?.({ ...block, content: { tabs: [...block.content.tabs, newTab] } });
          }}
          className="px-2 py-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          + Tab
        </button>
      </div>
      {block.content.tabs.map((tab) =>
        tab.id === activeTab ? (
          <textarea
            key={tab.id}
            value={tab.body}
            onChange={(e) => {
              const newTabs = block.content.tabs.map((t) =>
                t.id === tab.id ? { ...t, body: e.target.value } : t
              );
              onUpdate?.({ ...block, content: { tabs: newTabs } });
            }}
            rows={4}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            placeholder="Tab content..."
          />
        ) : null
      )}
    </div>
  );
}

// -- Main Block Renderer --
export default function BlockRenderer({ block, editable = false, onUpdate }: BlockRendererProps) {
  const alignClass =
    block.settings.alignment === "center"
      ? "text-center mx-auto"
      : block.settings.alignment === "right"
      ? "text-right ml-auto"
      : "";

  const widthClass =
    block.settings.width === "narrow"
      ? "max-w-lg"
      : block.settings.width === "wide"
      ? "max-w-4xl"
      : block.settings.width === "full"
      ? "max-w-full"
      : "max-w-2xl";

  const paddingClass =
    block.settings.padding === "none"
      ? ""
      : block.settings.padding === "small"
      ? "py-1"
      : block.settings.padding === "large"
      ? "py-6"
      : "py-3";

  const handleUpdate = (updated: ContentBlock) => {
    onUpdate?.(updated);
  };

  const renderBlock = () => {
    switch (block.type) {
      case "text":
        return <TextBlockEditor block={block as TextBlock} editable={editable} onUpdate={(b) => handleUpdate(b)} />;
      case "heading":
        return <HeadingBlockEditor block={block as HeadingBlock} editable={editable} onUpdate={(b) => handleUpdate(b)} />;
      case "image":
        return <ImageBlockEditor block={block as ImageBlock} editable={editable} onUpdate={(b) => handleUpdate(b)} />;
      case "video":
        return <VideoBlockEditor block={block as VideoBlock} editable={editable} onUpdate={(b) => handleUpdate(b)} />;
      case "code":
        return <CodeBlockEditor block={block as CodeBlock} editable={editable} onUpdate={(b) => handleUpdate(b)} />;
      case "embed":
        return <EmbedBlockEditor block={block as EmbedBlock} editable={editable} onUpdate={(b) => handleUpdate(b)} />;
      case "quiz_inline":
        return <QuizInlineBlockEditor block={block as QuizInlineBlock} editable={editable} onUpdate={(b) => handleUpdate(b)} />;
      case "divider":
        return <DividerBlockEditor block={block as DividerBlock} editable={editable} onUpdate={(b) => handleUpdate(b)} />;
      case "callout":
        return <CalloutBlockEditor block={block as CalloutBlock} editable={editable} onUpdate={(b) => handleUpdate(b)} />;
      case "accordion":
        return <AccordionBlockEditor block={block as AccordionBlock} editable={editable} onUpdate={(b) => handleUpdate(b)} />;
      case "tabs":
        return <TabsBlockEditor block={block as TabsBlock} editable={editable} onUpdate={(b) => handleUpdate(b)} />;
      default:
        return <p className="text-sm text-gray-400">Unknown block type</p>;
    }
  };

  return (
    <div className={`${alignClass} ${widthClass} ${paddingClass}`}>
      {renderBlock()}
    </div>
  );
}
