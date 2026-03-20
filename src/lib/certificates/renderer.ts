// Certificate rendering library
// Renders certificate templates to SVG and printable HTML

export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  example: string;
}

export interface TextElement {
  type: "text";
  id: string;
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: "serif" | "sans-serif" | "monospace";
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  color: string;
  align: "left" | "center" | "right";
}

export interface ImageElement {
  type: "image";
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LineElement {
  type: "line";
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: string;
  strokeWidth: number;
}

export interface ShapeElement {
  type: "shape";
  id: string;
  shape: "rectangle" | "circle" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

export type CertificateElement = TextElement | ImageElement | LineElement | ShapeElement;

export interface DesignData {
  background: {
    color: string;
    image_url: string | null;
    pattern: "classic" | "modern" | "elegant" | "custom" | "none";
  };
  dimensions: {
    width: number;
    height: number;
    orientation: "landscape" | "portrait";
  };
  elements: CertificateElement[];
  border: {
    enabled: boolean;
    color: string;
    width: number;
    style: "solid" | "double" | "dashed";
    padding: number;
  };
}

export interface CertificateData {
  learner_name: string;
  course_name: string;
  completion_date: string;
  score?: string;
  certificate_id: string;
  company_logo?: string;
  company_name?: string;
  verification_url?: string;
  issue_date: string;
  expiry_date?: string;
  credential_id: string;
}

/**
 * Returns the list of available template variables with descriptions.
 */
export function getTemplateVariables(): TemplateVariable[] {
  return [
    { key: "{{learner_name}}", label: "Learner Name", description: "Full name of the certificate recipient", example: "Jane Smith" },
    { key: "{{course_name}}", label: "Course Name", description: "Name of the completed course or certification", example: "Advanced Project Management" },
    { key: "{{completion_date}}", label: "Completion Date", description: "Date the course was completed", example: "March 15, 2026" },
    { key: "{{score}}", label: "Score", description: "Final assessment score (if applicable)", example: "95%" },
    { key: "{{certificate_id}}", label: "Certificate ID", description: "Unique certificate identifier", example: "LMS-A3F9-K2M4-7X2P" },
    { key: "{{company_logo}}", label: "Company Logo", description: "URL to the company/organization logo", example: "/logo.png" },
    { key: "{{company_name}}", label: "Company Name", description: "Name of the issuing organization", example: "LearnHub Inc." },
    { key: "{{verification_url}}", label: "Verification URL", description: "Public URL to verify the certificate", example: "https://lms.example.com/verify/LMS-A3F9-K2M4-7X2P" },
    { key: "{{issue_date}}", label: "Issue Date", description: "Date the certificate was issued", example: "March 15, 2026" },
    { key: "{{expiry_date}}", label: "Expiry Date", description: "Date the certificate expires (if applicable)", example: "March 15, 2027" },
    { key: "{{credential_id}}", label: "Credential ID", description: "Credential identifier for the certification", example: "CERT-8A2F3B1C" },
  ];
}

/**
 * Generates a unique, short verification code in format "LMS-XXXX-XXXX-XXXX".
 */
export function generateVerificationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluded I, O, 0, 1 to avoid confusion
  const generateGroup = () => {
    let group = "";
    for (let i = 0; i < 4; i++) {
      group += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return group;
  };
  return `LMS-${generateGroup()}-${generateGroup()}-${generateGroup()}`;
}

/**
 * Replace all {{variable}} placeholders in a string with actual values.
 */
function replacePlaceholders(text: string, data: CertificateData): string {
  return text
    .replace(/\{\{learner_name\}\}/g, data.learner_name || "")
    .replace(/\{\{course_name\}\}/g, data.course_name || "")
    .replace(/\{\{completion_date\}\}/g, data.completion_date || "")
    .replace(/\{\{score\}\}/g, data.score || "")
    .replace(/\{\{certificate_id\}\}/g, data.certificate_id || "")
    .replace(/\{\{company_logo\}\}/g, data.company_logo || "")
    .replace(/\{\{company_name\}\}/g, data.company_name || "")
    .replace(/\{\{verification_url\}\}/g, data.verification_url || "")
    .replace(/\{\{issue_date\}\}/g, data.issue_date || "")
    .replace(/\{\{expiry_date\}\}/g, data.expiry_date || "")
    .replace(/\{\{credential_id\}\}/g, data.credential_id || "");
}

/** Escape text for safe SVG embedding. */
function escSvg(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Map font family keyword to CSS-safe font stack. */
function fontFamilyCSS(family: string): string {
  switch (family) {
    case "serif": return "'Georgia', 'Times New Roman', serif";
    case "monospace": return "'Courier New', Courier, monospace";
    default: return "'Helvetica Neue', Arial, sans-serif";
  }
}

/** SVG text-anchor from alignment. */
function textAnchor(align: string): string {
  switch (align) {
    case "left": return "start";
    case "right": return "end";
    default: return "middle";
  }
}

/** Generate the ornamental pattern SVG defs for different patterns. */
function getPatternDefs(pattern: string, color: string): string {
  switch (pattern) {
    case "classic":
      return `
        <defs>
          <pattern id="ornate-corners" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M0 0 Q30 10 60 0 Q50 30 60 60 Q30 50 0 60 Q10 30 0 0Z" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.15"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ornate-corners)" />`;
    case "elegant":
      return `
        <defs>
          <linearGradient id="gold-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.1"/>
            <stop offset="50%" stop-color="#F5E6A3" stop-opacity="0.05"/>
            <stop offset="100%" stop-color="#D4AF37" stop-opacity="0.1"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#gold-gradient)" />`;
    case "modern":
      return `
        <defs>
          <linearGradient id="modern-accent" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.05"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#modern-accent)" />`;
    default:
      return "";
  }
}

/**
 * Render certificate template design_data + variable data into an SVG string.
 */
export function renderCertificateToSVG(design: DesignData, data: CertificateData): string {
  const { width, height } = design.dimensions;
  const bg = design.background;
  const border = design.border;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;

  // Background
  svg += `<rect width="${width}" height="${height}" fill="${escSvg(bg.color)}" />`;

  // Background image
  if (bg.image_url) {
    const resolvedUrl = replacePlaceholders(bg.image_url, data);
    svg += `<image href="${escSvg(resolvedUrl)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`;
  }

  // Pattern overlay
  if (bg.pattern && bg.pattern !== "none" && bg.pattern !== "custom") {
    svg += getPatternDefs(bg.pattern, border.color || "#4f46e5");
  }

  // Border
  if (border.enabled) {
    const pad = border.padding;
    const bw = border.width;
    const dashArray = border.style === "dashed" ? ` stroke-dasharray="8 4"` : "";

    if (border.style === "double") {
      // Outer border
      svg += `<rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}" fill="none" stroke="${escSvg(border.color)}" stroke-width="${bw}" rx="2" />`;
      // Inner border
      const innerPad = pad + bw + 4;
      svg += `<rect x="${innerPad}" y="${innerPad}" width="${width - innerPad * 2}" height="${height - innerPad * 2}" fill="none" stroke="${escSvg(border.color)}" stroke-width="${Math.max(1, bw - 1)}" rx="2" />`;
    } else {
      svg += `<rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}" fill="none" stroke="${escSvg(border.color)}" stroke-width="${bw}" rx="2"${dashArray} />`;
    }
  }

  // Elements
  for (const el of design.elements) {
    switch (el.type) {
      case "text": {
        const content = replacePlaceholders(el.content, data);
        const anchor = textAnchor(el.align);
        const weight = el.fontWeight || "normal";
        const style = el.fontStyle || "normal";
        svg += `<text x="${el.x}" y="${el.y}" text-anchor="${anchor}" dominant-baseline="middle" font-family="${fontFamilyCSS(el.fontFamily)}" font-size="${el.fontSize}" font-weight="${weight}" font-style="${style}" fill="${escSvg(el.color)}">${escSvg(content)}</text>`;
        break;
      }
      case "image": {
        const url = replacePlaceholders(el.url, data);
        if (url) {
          svg += `<image href="${escSvg(url)}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" preserveAspectRatio="xMidYMid meet" />`;
        }
        break;
      }
      case "line": {
        svg += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${escSvg(el.strokeColor)}" stroke-width="${el.strokeWidth}" />`;
        break;
      }
      case "shape": {
        const opacity = el.opacity ?? 1;
        if (el.shape === "circle") {
          const r = Math.min(el.width, el.height) / 2;
          svg += `<circle cx="${el.x + el.width / 2}" cy="${el.y + el.height / 2}" r="${r}" fill="${escSvg(el.fillColor)}" stroke="${escSvg(el.strokeColor)}" stroke-width="${el.strokeWidth}" opacity="${opacity}" />`;
        } else if (el.shape === "ellipse") {
          svg += `<ellipse cx="${el.x + el.width / 2}" cy="${el.y + el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${escSvg(el.fillColor)}" stroke="${escSvg(el.strokeColor)}" stroke-width="${el.strokeWidth}" opacity="${opacity}" />`;
        } else {
          svg += `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${escSvg(el.fillColor)}" stroke="${escSvg(el.strokeColor)}" stroke-width="${el.strokeWidth}" opacity="${opacity}" />`;
        }
        break;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

/**
 * Render certificate as a print-optimized HTML page.
 * This can be opened in a new window and printed or saved as PDF.
 */
export function renderCertificateToPDF(design: DesignData, data: CertificateData): string {
  const svgString = renderCertificateToSVG(design, data);
  const { width, height } = design.dimensions;
  const isLandscape = design.dimensions.orientation === "landscape";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Certificate - ${data.course_name}</title>
  <style>
    @page {
      size: ${isLandscape ? "landscape" : "portrait"};
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f3f4f6;
      font-family: sans-serif;
    }
    @media print {
      html, body { background: #fff; }
      .no-print { display: none !important; }
    }
    .certificate-wrapper {
      width: ${width}px;
      height: ${height}px;
      background: #fff;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .certificate-wrapper svg {
      width: 100%;
      height: 100%;
    }
    .actions {
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 8px;
      z-index: 100;
    }
    .actions button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-print {
      background: #4f46e5;
      color: #fff;
    }
    .btn-print:hover { background: #4338ca; }
    .btn-close {
      background: #e5e7eb;
      color: #374151;
    }
    .btn-close:hover { background: #d1d5db; }
  </style>
</head>
<body>
  <div class="actions no-print">
    <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
    <button class="btn-close" onclick="window.close()">Close</button>
  </div>
  <div class="certificate-wrapper">
    ${svgString}
  </div>
</body>
</html>`;
}

/**
 * Default design data for preset templates.
 */
export function getPresetTemplate(preset: "classic" | "modern" | "elegant" | "corporate"): DesignData {
  const baseWidth = 1056;
  const baseHeight = 816;

  const baseDesign: DesignData = {
    background: { color: "#ffffff", image_url: null, pattern: "none" },
    dimensions: { width: baseWidth, height: baseHeight, orientation: "landscape" },
    elements: [],
    border: { enabled: true, color: "#4f46e5", width: 3, style: "double", padding: 20 },
  };

  switch (preset) {
    case "classic":
      return {
        ...baseDesign,
        background: { color: "#fffbf0", image_url: null, pattern: "classic" },
        border: { enabled: true, color: "#8B7355", width: 4, style: "double", padding: 24 },
        elements: [
          { type: "text", id: "header", content: "CERTIFICATE OF COMPLETION", x: 528, y: 100, fontSize: 16, fontFamily: "serif", fontWeight: "bold", color: "#8B7355", align: "center" },
          { type: "line", id: "top-divider", x1: 328, y1: 130, x2: 728, y2: 130, strokeColor: "#8B7355", strokeWidth: 1 },
          { type: "text", id: "title", content: "{{course_name}}", x: 528, y: 200, fontSize: 36, fontFamily: "serif", fontWeight: "bold", color: "#1a1a2e", align: "center" },
          { type: "text", id: "subtitle", content: "This certificate is proudly presented to", x: 528, y: 280, fontSize: 16, fontFamily: "serif", color: "#666", align: "center" },
          { type: "text", id: "recipient", content: "{{learner_name}}", x: 528, y: 340, fontSize: 32, fontFamily: "serif", fontWeight: "bold", color: "#1a1a2e", align: "center" },
          { type: "line", id: "name-underline", x1: 280, y1: 365, x2: 776, y2: 365, strokeColor: "#8B7355", strokeWidth: 1 },
          { type: "text", id: "body", content: "for successfully completing all requirements", x: 528, y: 420, fontSize: 16, fontFamily: "serif", color: "#666", align: "center" },
          { type: "text", id: "date", content: "Issued on {{issue_date}}", x: 528, y: 490, fontSize: 14, fontFamily: "serif", color: "#888", align: "center" },
          { type: "text", id: "credential", content: "Credential ID: {{credential_id}}", x: 528, y: 530, fontSize: 12, fontFamily: "monospace", color: "#999", align: "center" },
          { type: "text", id: "company", content: "{{company_name}}", x: 528, y: 600, fontSize: 18, fontFamily: "serif", fontWeight: "bold", color: "#1a1a2e", align: "center" },
          { type: "line", id: "bottom-divider", x1: 328, y1: 630, x2: 728, y2: 630, strokeColor: "#8B7355", strokeWidth: 1 },
          { type: "text", id: "verify", content: "Verify at: {{verification_url}}", x: 528, y: 750, fontSize: 10, fontFamily: "sans-serif", color: "#aaa", align: "center" },
        ],
      };

    case "modern":
      return {
        ...baseDesign,
        background: { color: "#ffffff", image_url: null, pattern: "modern" },
        border: { enabled: true, color: "#4f46e5", width: 2, style: "solid", padding: 16 },
        elements: [
          { type: "shape", id: "accent-bar", shape: "rectangle", x: 0, y: 0, width: 8, height: 816, fillColor: "#4f46e5", strokeColor: "transparent", strokeWidth: 0, opacity: 1 },
          { type: "text", id: "header", content: "CERTIFICATE", x: 528, y: 80, fontSize: 14, fontFamily: "sans-serif", fontWeight: "bold", color: "#4f46e5", align: "center" },
          { type: "text", id: "title", content: "{{course_name}}", x: 528, y: 160, fontSize: 34, fontFamily: "sans-serif", fontWeight: "bold", color: "#111827", align: "center" },
          { type: "line", id: "divider", x1: 428, y1: 200, x2: 628, y2: 200, strokeColor: "#4f46e5", strokeWidth: 3 },
          { type: "text", id: "subtitle", content: "Awarded to", x: 528, y: 260, fontSize: 14, fontFamily: "sans-serif", color: "#6b7280", align: "center" },
          { type: "text", id: "recipient", content: "{{learner_name}}", x: 528, y: 320, fontSize: 30, fontFamily: "sans-serif", fontWeight: "bold", color: "#111827", align: "center" },
          { type: "text", id: "body", content: "for the successful completion of all course requirements", x: 528, y: 390, fontSize: 14, fontFamily: "sans-serif", color: "#6b7280", align: "center" },
          { type: "text", id: "score-label", content: "Score: {{score}}", x: 528, y: 440, fontSize: 16, fontFamily: "sans-serif", fontWeight: "bold", color: "#4f46e5", align: "center" },
          { type: "text", id: "date", content: "{{issue_date}}", x: 260, y: 560, fontSize: 14, fontFamily: "sans-serif", color: "#374151", align: "center" },
          { type: "text", id: "date-label", content: "Date Issued", x: 260, y: 585, fontSize: 11, fontFamily: "sans-serif", color: "#9ca3af", align: "center" },
          { type: "text", id: "expiry", content: "{{expiry_date}}", x: 528, y: 560, fontSize: 14, fontFamily: "sans-serif", color: "#374151", align: "center" },
          { type: "text", id: "expiry-label", content: "Valid Until", x: 528, y: 585, fontSize: 11, fontFamily: "sans-serif", color: "#9ca3af", align: "center" },
          { type: "text", id: "id", content: "{{credential_id}}", x: 796, y: 560, fontSize: 14, fontFamily: "monospace", color: "#374151", align: "center" },
          { type: "text", id: "id-label", content: "Certificate ID", x: 796, y: 585, fontSize: 11, fontFamily: "sans-serif", color: "#9ca3af", align: "center" },
          { type: "text", id: "company", content: "{{company_name}}", x: 528, y: 680, fontSize: 16, fontFamily: "sans-serif", fontWeight: "bold", color: "#111827", align: "center" },
          { type: "text", id: "verify", content: "{{verification_url}}", x: 528, y: 760, fontSize: 10, fontFamily: "sans-serif", color: "#9ca3af", align: "center" },
        ],
      };

    case "elegant":
      return {
        ...baseDesign,
        background: { color: "#faf9f6", image_url: null, pattern: "elegant" },
        border: { enabled: true, color: "#D4AF37", width: 3, style: "double", padding: 28 },
        elements: [
          { type: "line", id: "gold-top", x1: 60, y1: 60, x2: 996, y2: 60, strokeColor: "#D4AF37", strokeWidth: 1 },
          { type: "line", id: "gold-bottom", x1: 60, y1: 756, x2: 996, y2: 756, strokeColor: "#D4AF37", strokeWidth: 1 },
          { type: "text", id: "header", content: "Certificate of Achievement", x: 528, y: 120, fontSize: 20, fontFamily: "serif", fontStyle: "italic", color: "#D4AF37", align: "center" },
          { type: "text", id: "title", content: "{{course_name}}", x: 528, y: 210, fontSize: 38, fontFamily: "serif", fontWeight: "bold", color: "#2d2d2d", align: "center" },
          { type: "text", id: "presented", content: "is hereby conferred upon", x: 528, y: 290, fontSize: 16, fontFamily: "serif", fontStyle: "italic", color: "#777", align: "center" },
          { type: "text", id: "recipient", content: "{{learner_name}}", x: 528, y: 360, fontSize: 34, fontFamily: "serif", fontWeight: "bold", color: "#2d2d2d", align: "center" },
          { type: "line", id: "gold-divider", x1: 300, y1: 395, x2: 756, y2: 395, strokeColor: "#D4AF37", strokeWidth: 2 },
          { type: "text", id: "body", content: "in recognition of outstanding achievement and dedication", x: 528, y: 440, fontSize: 15, fontFamily: "serif", fontStyle: "italic", color: "#666", align: "center" },
          { type: "text", id: "date", content: "Awarded on {{issue_date}}", x: 528, y: 510, fontSize: 14, fontFamily: "serif", color: "#888", align: "center" },
          { type: "text", id: "company", content: "{{company_name}}", x: 528, y: 600, fontSize: 20, fontFamily: "serif", fontWeight: "bold", color: "#2d2d2d", align: "center" },
          { type: "text", id: "credential", content: "{{credential_id}}", x: 528, y: 650, fontSize: 12, fontFamily: "monospace", color: "#999", align: "center" },
          { type: "text", id: "verify", content: "{{verification_url}}", x: 528, y: 730, fontSize: 10, fontFamily: "sans-serif", color: "#bbb", align: "center" },
        ],
      };

    case "corporate":
      return {
        ...baseDesign,
        background: { color: "#ffffff", image_url: null, pattern: "none" },
        border: { enabled: true, color: "#1e3a5f", width: 2, style: "solid", padding: 16 },
        elements: [
          { type: "shape", id: "header-bg", shape: "rectangle", x: 0, y: 0, width: 1056, height: 140, fillColor: "#1e3a5f", strokeColor: "transparent", strokeWidth: 0, opacity: 1 },
          { type: "image", id: "logo", url: "{{company_logo}}", x: 40, y: 30, width: 160, height: 80 },
          { type: "text", id: "company-header", content: "{{company_name}}", x: 528, y: 70, fontSize: 24, fontFamily: "sans-serif", fontWeight: "bold", color: "#ffffff", align: "center" },
          { type: "text", id: "cert-type", content: "PROFESSIONAL CERTIFICATE", x: 528, y: 105, fontSize: 12, fontFamily: "sans-serif", color: "#94a3b8", align: "center" },
          { type: "text", id: "title", content: "{{course_name}}", x: 528, y: 220, fontSize: 30, fontFamily: "sans-serif", fontWeight: "bold", color: "#1e3a5f", align: "center" },
          { type: "line", id: "divider", x1: 350, y1: 255, x2: 706, y2: 255, strokeColor: "#1e3a5f", strokeWidth: 2 },
          { type: "text", id: "awarded-to", content: "This certifies that", x: 528, y: 300, fontSize: 14, fontFamily: "sans-serif", color: "#64748b", align: "center" },
          { type: "text", id: "recipient", content: "{{learner_name}}", x: 528, y: 360, fontSize: 28, fontFamily: "sans-serif", fontWeight: "bold", color: "#1e293b", align: "center" },
          { type: "text", id: "desc", content: "has successfully met all requirements for certification", x: 528, y: 410, fontSize: 14, fontFamily: "sans-serif", color: "#64748b", align: "center" },
          { type: "text", id: "score", content: "Score: {{score}}", x: 528, y: 460, fontSize: 16, fontFamily: "sans-serif", fontWeight: "bold", color: "#1e3a5f", align: "center" },
          { type: "text", id: "issue-date", content: "Issue Date: {{issue_date}}", x: 300, y: 560, fontSize: 13, fontFamily: "sans-serif", color: "#475569", align: "center" },
          { type: "text", id: "expiry-date", content: "Valid Until: {{expiry_date}}", x: 756, y: 560, fontSize: 13, fontFamily: "sans-serif", color: "#475569", align: "center" },
          { type: "line", id: "sig-line-left", x1: 180, y1: 640, x2: 420, y2: 640, strokeColor: "#cbd5e1", strokeWidth: 1 },
          { type: "text", id: "sig-label-left", content: "Authorized Signature", x: 300, y: 660, fontSize: 11, fontFamily: "sans-serif", color: "#94a3b8", align: "center" },
          { type: "line", id: "sig-line-right", x1: 636, y1: 640, x2: 876, y2: 640, strokeColor: "#cbd5e1", strokeWidth: 1 },
          { type: "text", id: "sig-label-right", content: "Date", x: 756, y: 660, fontSize: 11, fontFamily: "sans-serif", color: "#94a3b8", align: "center" },
          { type: "text", id: "credential", content: "Credential: {{credential_id}}", x: 528, y: 720, fontSize: 11, fontFamily: "monospace", color: "#94a3b8", align: "center" },
          { type: "text", id: "verify", content: "Verify: {{verification_url}}", x: 528, y: 750, fontSize: 10, fontFamily: "sans-serif", color: "#94a3b8", align: "center" },
          { type: "shape", id: "footer-bar", shape: "rectangle", x: 0, y: 790, width: 1056, height: 26, fillColor: "#1e3a5f", strokeColor: "transparent", strokeWidth: 0, opacity: 1 },
        ],
      };

    default:
      return baseDesign;
  }
}

/**
 * Get sample data for template preview.
 */
export function getSampleCertificateData(): CertificateData {
  return {
    learner_name: "Jane Smith",
    course_name: "Advanced Project Management",
    completion_date: "March 15, 2026",
    score: "95%",
    certificate_id: "LMS-A3F9-K2M4-7X2P",
    company_logo: "",
    company_name: "LearnHub Inc.",
    verification_url: "https://lms.example.com/verify/LMS-A3F9-K2M4-7X2P",
    issue_date: "March 15, 2026",
    expiry_date: "March 15, 2027",
    credential_id: "CERT-8A2F3B1C",
  };
}
