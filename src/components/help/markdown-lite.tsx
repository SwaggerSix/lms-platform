import React from "react";
import Link from "next/link";

/**
 * Tiny, dependency-free renderer for the small markdown dialect used in
 * help manual content. Supports:
 *   - paragraphs (blank-line separated)
 *   - **bold**, *italic*, `inline code`
 *   - [label](/url) links (internal Next links if starting with /, external otherwise)
 *   - lines starting with "- " become a <ul> bullet list (consecutive ones grouped)
 *   - lines starting with "1. " become an <ol> numbered list (the actual number is ignored)
 *   - lines starting with "> " become a callout block
 *   - "# ", "## ", "### " lines become headings
 *   - "| a | b |" lines become a table (first row is the header; a
 *     "|---|---|" separator row is skipped)
 *
 * This is deliberately minimal — no HTML passthrough — so editors can't
 * accidentally introduce XSS via content files.
 */

type Inline = string | React.ReactElement;

function renderInline(text: string, keyPrefix: string): Inline[] {
  const out: Inline[] = [];
  // Combined regex for **bold**, *italic*, `code`, [label](href)
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(text.slice(lastIndex, match.index));
    }
    const [, , bold, italic, code, linkLabel, linkHref] = match;
    const key = `${keyPrefix}-${i++}`;
    if (bold) {
      out.push(
        <strong key={key} className="font-semibold text-gray-900">
          {bold}
        </strong>
      );
    } else if (italic) {
      out.push(
        <em key={key} className="italic">
          {italic}
        </em>
      );
    } else if (code) {
      out.push(
        <code key={key} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.85em] text-gray-800">
          {code}
        </code>
      );
    } else if (linkLabel && linkHref) {
      const isInternal = linkHref.startsWith("/");
      out.push(
        isInternal ? (
          <Link key={key} href={linkHref} className="font-medium text-primary-600 hover:text-primary-700 hover:underline">
            {linkLabel}
          </Link>
        ) : (
          <a key={key} href={linkHref} className="font-medium text-primary-600 hover:text-primary-700 hover:underline" target="_blank" rel="noopener noreferrer">
            {linkLabel}
          </a>
        )
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "callout"; lines: string[] }
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "table"; rows: string[][] };

function tableCells(line: string): string[] {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "h", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      continue;
    }
    if (line.startsWith("|") && line.endsWith("|")) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue; // separator row
      if (current?.kind !== "table") {
        flush();
        current = { kind: "table", rows: [] };
      }
      (current as { kind: "table"; rows: string[][] }).rows.push(tableCells(line));
      continue;
    }
    if (line.startsWith("- ")) {
      if (current?.kind !== "ul") {
        flush();
        current = { kind: "ul", items: [] };
      }
      (current as { kind: "ul"; items: string[] }).items.push(line.slice(2));
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      if (current?.kind !== "ol") {
        flush();
        current = { kind: "ol", items: [] };
      }
      (current as { kind: "ol"; items: string[] }).items.push(line.replace(/^\d+\.\s/, ""));
      continue;
    }
    if (line.startsWith("> ")) {
      if (current?.kind !== "callout") {
        flush();
        current = { kind: "callout", lines: [] };
      }
      (current as { kind: "callout"; lines: string[] }).lines.push(line.slice(2));
      continue;
    }
    if (current?.kind !== "p") {
      flush();
      current = { kind: "p", lines: [] };
    }
    (current as { kind: "p"; lines: string[] }).lines.push(line);
  }
  flush();
  return blocks;
}

export function MarkdownLite({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-gray-700">
      {blocks.map((block, i) => {
        const key = `b-${i}`;
        if (block.kind === "p") {
          return (
            <p key={key}>
              {block.lines.map((l, j) => (
                <React.Fragment key={j}>
                  {j > 0 && <br />}
                  {renderInline(l, `${key}-${j}`)}
                </React.Fragment>
              ))}
            </p>
          );
        }
        if (block.kind === "h") {
          const cls =
            block.level === 1
              ? "pt-2 text-xl font-bold text-gray-900"
              : block.level === 2
                ? "pt-2 text-lg font-semibold text-gray-900"
                : "pt-1 text-base font-semibold text-gray-900";
          const Tag = (`h${block.level + 1}`) as "h2" | "h3" | "h4";
          return (
            <Tag key={key} className={cls}>
              {renderInline(block.text, key)}
            </Tag>
          );
        }
        if (block.kind === "table") {
          const [head, ...body] = block.rows;
          return (
            <div key={key} className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    {head.map((c, j) => (
                      <th key={j} scope="col" className="border border-gray-200 bg-gray-50 px-3 py-2 font-semibold text-gray-900">
                        {renderInline(c, `${key}-h${j}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, r) => (
                    <tr key={r}>
                      {row.map((c, j) => (
                        <td key={j} className="border border-gray-200 px-3 py-2 align-top">
                          {renderInline(c, `${key}-${r}-${j}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.kind === "ul") {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item, `${key}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === "ol") {
          return (
            <ol key={key} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item, `${key}-${j}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <div
            key={key}
            className="rounded-md border-l-4 border-primary-300 bg-primary-50 px-4 py-2 text-sm text-primary-900"
          >
            {block.lines.map((l, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(l, `${key}-${j}`)}
              </React.Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default MarkdownLite;
