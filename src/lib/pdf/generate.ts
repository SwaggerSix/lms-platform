import { jsPDF } from "jspdf";

// ---- Certificate PDF ----

interface CertificateInput {
  learnerName: string;
  courseName: string;
  completionDate: string;
  score?: number;
  credentialId: string;
  certificationName: string;
}

/**
 * Generate a landscape A4 certificate PDF with a decorative border,
 * learner details, and credential information.
 */
export async function generateCertificatePDF(data: CertificateInput): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // 297
  const pageH = doc.internal.pageSize.getHeight(); // 210
  const cx = pageW / 2;

  // --- Background fill ---
  doc.setFillColor(255, 251, 240); // warm ivory
  doc.rect(0, 0, pageW, pageH, "F");

  // --- Double border ---
  const borderColor: [number, number, number] = [139, 115, 85]; // warm brown
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(1.2);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  doc.setLineWidth(0.4);
  doc.rect(12, 12, pageW - 24, pageH - 24);

  // --- Corner ornaments (small L-shapes) ---
  const ornLen = 18;
  const ornOff = 14;
  doc.setLineWidth(0.6);
  // Top-left
  doc.line(ornOff, ornOff, ornOff + ornLen, ornOff);
  doc.line(ornOff, ornOff, ornOff, ornOff + ornLen);
  // Top-right
  doc.line(pageW - ornOff, ornOff, pageW - ornOff - ornLen, ornOff);
  doc.line(pageW - ornOff, ornOff, pageW - ornOff, ornOff + ornLen);
  // Bottom-left
  doc.line(ornOff, pageH - ornOff, ornOff + ornLen, pageH - ornOff);
  doc.line(ornOff, pageH - ornOff, ornOff, pageH - ornOff - ornLen);
  // Bottom-right
  doc.line(pageW - ornOff, pageH - ornOff, pageW - ornOff - ornLen, pageH - ornOff);
  doc.line(pageW - ornOff, pageH - ornOff, pageW - ornOff, pageH - ornOff - ornLen);

  // --- Header text ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(139, 115, 85);
  doc.text("CERTIFICATE OF COMPLETION", cx, 38, { align: "center" });

  // Decorative divider line
  doc.setLineWidth(0.5);
  doc.line(cx - 40, 43, cx + 40, 43);

  // --- Certification / Course Name ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(26, 26, 46);
  const titleLines = doc.splitTextToSize(data.certificationName || data.courseName, pageW - 80);
  doc.text(titleLines, cx, 62, { align: "center" });

  // --- Presented to ---
  const nameY = 62 + titleLines.length * 10 + 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text("This certificate is proudly presented to", cx, nameY, { align: "center" });

  // --- Learner name ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(26, 26, 46);
  doc.text(data.learnerName, cx, nameY + 16, { align: "center" });

  // Underline for name
  const nameWidth = doc.getTextWidth(data.learnerName);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.line(cx - nameWidth / 2 - 4, nameY + 19, cx + nameWidth / 2 + 4, nameY + 19);

  // --- Course name (if different from certification) ---
  let nextY = nameY + 32;
  if (data.courseName && data.courseName !== data.certificationName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Course: ${data.courseName}`, cx, nextY, { align: "center" });
    nextY += 10;
  }

  // --- Score (optional) ---
  if (data.score !== undefined && data.score !== null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(79, 70, 229);
    doc.text(`Score: ${data.score}%`, cx, nextY, { align: "center" });
    nextY += 10;
  }

  // --- Completion date ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(136, 136, 136);
  doc.text(`Completed on ${data.completionDate}`, cx, nextY + 4, { align: "center" });

  // --- Credential ID ---
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(`Credential ID: ${data.credentialId}`, cx, pageH - 24, { align: "center" });

  // --- Footer divider ---
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.line(cx - 40, pageH - 30, cx + 40, pageH - 30);

  // Return as Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// ---- Report PDF ----

interface ReportInput {
  title: string;
  reportType: string;
  generatedDate: string;
  rows: Record<string, unknown>[];
  filters?: Record<string, string>;
}

/**
 * Generate a portrait A4 report PDF with a title header, optional
 * filter summary, and a data table rendered from the provided rows.
 */
export async function generateReportPDF(data: ReportInput): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;

  // --- Header bar ---
  doc.setFillColor(30, 58, 95); // dark blue
  doc.rect(0, 0, pageW, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(data.title, marginL, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 210, 225);
  doc.text(`Report Type: ${data.reportType}`, marginL, 20);
  doc.text(`Generated: ${data.generatedDate}`, pageW - marginR, 20, { align: "right" });

  let cursorY = 36;

  // --- Filters section ---
  if (data.filters && Object.keys(data.filters).length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("Applied Filters:", marginL, cursorY);
    cursorY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    for (const [key, value] of Object.entries(data.filters)) {
      if (value) {
        doc.text(`${key}: ${value}`, marginL + 2, cursorY);
        cursorY += 4;
      }
    }
    cursorY += 4;
  }

  // --- Data table ---
  if (data.rows.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("No data available for this report.", marginL, cursorY + 6);

    const arrayBuffer = doc.output("arraybuffer");
    return Buffer.from(arrayBuffer);
  }

  const headers = Object.keys(data.rows[0]);
  const colCount = headers.length;
  const colW = contentW / colCount;
  const rowH = 6;
  const headerH = 7;
  const maxTextWidth = colW - 2;

  // Helper: add a new page and return reset Y
  function newPage(): number {
    doc.addPage();
    return 14;
  }

  // Table header
  function drawTableHeader(y: number): number {
    doc.setFillColor(240, 242, 245);
    doc.rect(marginL, y, contentW, headerH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(30, 58, 95);

    headers.forEach((h, i) => {
      const label = h.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const truncated = truncateText(doc, label, maxTextWidth);
      doc.text(truncated, marginL + i * colW + 1, y + 5);
    });

    // Header bottom line
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.3);
    doc.line(marginL, y + headerH, marginL + contentW, y + headerH);

    return y + headerH;
  }

  cursorY = drawTableHeader(cursorY);

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  for (let rowIdx = 0; rowIdx < data.rows.length; rowIdx++) {
    if (cursorY + rowH > pageH - 14) {
      cursorY = newPage();
      cursorY = drawTableHeader(cursorY);
    }

    // Zebra striping
    if (rowIdx % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(marginL, cursorY, contentW, rowH, "F");
    }

    doc.setTextColor(55, 65, 81);
    const row = data.rows[rowIdx];
    headers.forEach((h, i) => {
      const val = row[h];
      const str = val === null || val === undefined ? "" : String(val);
      const truncated = truncateText(doc, str, maxTextWidth);
      doc.text(truncated, marginL + i * colW + 1, cursorY + 4);
    });

    // Light row divider
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.1);
    doc.line(marginL, cursorY + rowH, marginL + contentW, cursorY + rowH);

    cursorY += rowH;
  }

  // --- Footer on last page ---
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `Total rows: ${data.rows.length}  |  Generated by LearnHub LMS`,
    cx(pageW),
    pageH - 8,
    { align: "center" }
  );

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// ---- Helpers ----

function cx(pageW: number) {
  return pageW / 2;
}

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && doc.getTextWidth(t + "...") > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "...";
}
