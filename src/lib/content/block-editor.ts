// ============================================
// Content Block Editor Library
// ============================================

import { v4 as uuidv4 } from "uuid";

// Block type union
export type BlockType =
  | "text"
  | "heading"
  | "image"
  | "video"
  | "code"
  | "embed"
  | "quiz_inline"
  | "divider"
  | "callout"
  | "accordion"
  | "tabs";

// Base block interface
export interface BaseBlock {
  id: string;
  type: BlockType;
  settings: BlockSettings;
}

export interface BlockSettings {
  alignment?: "left" | "center" | "right";
  width?: "narrow" | "normal" | "wide" | "full";
  backgroundColor?: string;
  padding?: "none" | "small" | "medium" | "large";
}

// Individual block types
export interface TextBlock extends BaseBlock {
  type: "text";
  content: {
    html: string;
  };
}

export interface HeadingBlock extends BaseBlock {
  type: "heading";
  content: {
    text: string;
    level: 1 | 2 | 3 | 4;
  };
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  content: {
    url: string;
    alt: string;
    caption?: string;
  };
}

export interface VideoBlock extends BaseBlock {
  type: "video";
  content: {
    url: string;
    provider?: "youtube" | "vimeo" | "custom";
    caption?: string;
  };
}

export interface CodeBlock extends BaseBlock {
  type: "code";
  content: {
    code: string;
    language: string;
    showLineNumbers?: boolean;
    caption?: string;
  };
}

export interface EmbedBlock extends BaseBlock {
  type: "embed";
  content: {
    url: string;
    html?: string;
    height?: number;
  };
}

export interface QuizInlineBlock extends BaseBlock {
  type: "quiz_inline";
  content: {
    question: string;
    options: { id: string; text: string; isCorrect: boolean }[];
    explanation?: string;
  };
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
  content: {
    style: "solid" | "dashed" | "dotted" | "gradient";
  };
}

export interface CalloutBlock extends BaseBlock {
  type: "callout";
  content: {
    variant: "info" | "warning" | "success" | "error" | "tip";
    title?: string;
    text: string;
  };
}

export interface AccordionBlock extends BaseBlock {
  type: "accordion";
  content: {
    items: { id: string; title: string; body: string }[];
  };
}

export interface TabsBlock extends BaseBlock {
  type: "tabs";
  content: {
    tabs: { id: string; label: string; body: string }[];
  };
}

// Union type of all blocks
export type ContentBlock =
  | TextBlock
  | HeadingBlock
  | ImageBlock
  | VideoBlock
  | CodeBlock
  | EmbedBlock
  | QuizInlineBlock
  | DividerBlock
  | CalloutBlock
  | AccordionBlock
  | TabsBlock;

// Default content for each block type
const defaultContent: Record<BlockType, () => ContentBlock["content"]> = {
  text: () => ({ html: "<p>Start typing...</p>" }),
  heading: () => ({ text: "Heading", level: 2 }),
  image: () => ({ url: "", alt: "" }),
  video: () => ({ url: "", provider: "youtube" as const }),
  code: () => ({ code: "", language: "javascript", showLineNumbers: true }),
  embed: () => ({ url: "", height: 400 }),
  quiz_inline: () => ({
    question: "Enter your question",
    options: [
      { id: uuidv4(), text: "Option A", isCorrect: true },
      { id: uuidv4(), text: "Option B", isCorrect: false },
    ],
    explanation: "",
  }),
  divider: () => ({ style: "solid" as const }),
  callout: () => ({ variant: "info" as const, title: "", text: "Enter callout text..." }),
  accordion: () => ({
    items: [{ id: uuidv4(), title: "Section 1", body: "Content here..." }],
  }),
  tabs: () => ({
    tabs: [
      { id: uuidv4(), label: "Tab 1", body: "Content for tab 1..." },
      { id: uuidv4(), label: "Tab 2", body: "Content for tab 2..." },
    ],
  }),
};

// Default settings
const defaultSettings: BlockSettings = {
  alignment: "left",
  width: "normal",
  padding: "medium",
};

/**
 * Create a new block of the specified type with default content
 */
export function createBlock(type: BlockType): ContentBlock {
  return {
    id: uuidv4(),
    type,
    content: defaultContent[type](),
    settings: { ...defaultSettings },
  } as ContentBlock;
}

/**
 * Serialize blocks to JSON for storage
 */
export function serializeBlocks(blocks: ContentBlock[]): string {
  return JSON.stringify(blocks);
}

/**
 * Deserialize blocks from JSON storage
 */
export function deserializeBlocks(json: string | object): ContentBlock[] {
  if (typeof json === "string") {
    try {
      return JSON.parse(json) as ContentBlock[];
    } catch {
      return [];
    }
  }
  if (Array.isArray(json)) {
    return json as ContentBlock[];
  }
  return [];
}

/**
 * Reorder blocks by moving an item from one index to another
 */
export function reorderBlocks(
  blocks: ContentBlock[],
  fromIndex: number,
  toIndex: number
): ContentBlock[] {
  if (
    fromIndex < 0 ||
    fromIndex >= blocks.length ||
    toIndex < 0 ||
    toIndex >= blocks.length
  ) {
    return blocks;
  }
  const result = [...blocks];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}

/**
 * Validate a block has required fields
 */
export function validateBlock(block: ContentBlock): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!block.id) errors.push("Block ID is required");
  if (!block.type) errors.push("Block type is required");

  const validTypes: BlockType[] = [
    "text", "heading", "image", "video", "code",
    "embed", "quiz_inline", "divider", "callout",
    "accordion", "tabs",
  ];
  if (!validTypes.includes(block.type)) {
    errors.push(`Invalid block type: ${block.type}`);
  }

  // Type-specific validation
  switch (block.type) {
    case "heading":
      if (!(block as HeadingBlock).content.text) errors.push("Heading text is required");
      break;
    case "image":
      // URL can be empty during editing
      break;
    case "video":
      break;
    case "code":
      if (!(block as CodeBlock).content.language) errors.push("Code language is required");
      break;
    case "quiz_inline": {
      const quiz = block as QuizInlineBlock;
      if (!quiz.content.question) errors.push("Quiz question is required");
      if (!quiz.content.options || quiz.content.options.length < 2)
        errors.push("Quiz needs at least 2 options");
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

// Block type metadata for the picker UI
export interface BlockTypeMeta {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
  category: "basic" | "media" | "interactive" | "layout";
}

export const blockTypesMeta: BlockTypeMeta[] = [
  { type: "text", label: "Text", description: "Rich text paragraph", icon: "Type", category: "basic" },
  { type: "heading", label: "Heading", description: "Section heading (H1-H4)", icon: "Heading", category: "basic" },
  { type: "divider", label: "Divider", description: "Horizontal divider line", icon: "Minus", category: "basic" },
  { type: "callout", label: "Callout", description: "Highlighted callout box", icon: "AlertCircle", category: "basic" },
  { type: "image", label: "Image", description: "Upload or embed image", icon: "Image", category: "media" },
  { type: "video", label: "Video", description: "Embed video content", icon: "Play", category: "media" },
  { type: "code", label: "Code", description: "Code snippet with highlighting", icon: "Code", category: "media" },
  { type: "embed", label: "Embed", description: "External embed (iframe)", icon: "Globe", category: "media" },
  { type: "quiz_inline", label: "Inline Quiz", description: "Multiple choice question", icon: "HelpCircle", category: "interactive" },
  { type: "accordion", label: "Accordion", description: "Collapsible sections", icon: "ChevronDown", category: "interactive" },
  { type: "tabs", label: "Tabs", description: "Tabbed content panels", icon: "Columns", category: "layout" },
];
