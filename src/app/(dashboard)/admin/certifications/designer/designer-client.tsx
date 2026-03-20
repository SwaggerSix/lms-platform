"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import {
  Award,
  Download,
  Save,
  Eye,
  Palette,
  Plus,
  Trash2,
  Type,
  Image as ImageIcon,
  Minus,
  Square,
  Star,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  X,
  Loader2,
  Check,
  Copy,
  Layers,
} from "lucide-react";
import { cn } from "@/utils/cn";
import {
  renderCertificateToSVG,
  getPresetTemplate,
  getSampleCertificateData,
  getTemplateVariables,
  type DesignData,
  type CertificateElement,
  type TextElement,
  type ImageElement,
  type LineElement,
  type ShapeElement,
  type CertificateData,
} from "@/lib/certificates/renderer";

interface Template {
  id: string;
  name: string;
  description: string | null;
  design_data: DesignData;
  is_default: boolean;
  status: string;
  created_at: string;
}

interface DesignerClientProps {
  templates: Template[];
}

type PanelSection = "background" | "elements" | "border" | "presets";

function generateElementId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function defaultTextElement(): TextElement {
  return {
    type: "text",
    id: generateElementId(),
    content: "New Text",
    x: 528,
    y: 400,
    fontSize: 20,
    fontFamily: "sans-serif",
    fontWeight: "normal",
    fontStyle: "normal",
    color: "#333333",
    align: "center",
  };
}

function defaultImageElement(): ImageElement {
  return {
    type: "image",
    id: generateElementId(),
    url: "",
    x: 50,
    y: 50,
    width: 120,
    height: 60,
  };
}

function defaultLineElement(): LineElement {
  return {
    type: "line",
    id: generateElementId(),
    x1: 200,
    y1: 400,
    x2: 856,
    y2: 400,
    strokeColor: "#4f46e5",
    strokeWidth: 2,
  };
}

function defaultShapeElement(): ShapeElement {
  return {
    type: "shape",
    id: generateElementId(),
    shape: "rectangle",
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    fillColor: "#e0e7ff",
    strokeColor: "#4f46e5",
    strokeWidth: 1,
    opacity: 1,
  };
}

export default function DesignerClient({ templates: initialTemplates }: DesignerClientProps) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("Untitled Template");
  const [templateDescription, setTemplateDescription] = useState("");
  const [design, setDesign] = useState<DesignData>(getPresetTemplate("classic"));
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<PanelSection>("elements");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const sampleData = useMemo(() => getSampleCertificateData(), []);
  const templateVariables = useMemo(() => getTemplateVariables(), []);

  const selectedElement = useMemo(() => {
    if (!selectedElementId) return null;
    return design.elements.find((el) => el.id === selectedElementId) || null;
  }, [selectedElementId, design.elements]);

  const svgPreview = useMemo(() => {
    const data: CertificateData = previewMode ? sampleData : {
      learner_name: "{{learner_name}}",
      course_name: "{{course_name}}",
      completion_date: "{{completion_date}}",
      score: "{{score}}",
      certificate_id: "{{certificate_id}}",
      company_logo: "{{company_logo}}",
      company_name: "{{company_name}}",
      verification_url: "{{verification_url}}",
      issue_date: "{{issue_date}}",
      expiry_date: "{{expiry_date}}",
      credential_id: "{{credential_id}}",
    };
    return renderCertificateToSVG(design, data);
  }, [design, previewMode, sampleData]);

  const updateDesign = useCallback((updater: (prev: DesignData) => DesignData) => {
    setDesign((prev) => updater(prev));
  }, []);

  const updateElement = useCallback((elementId: string, updates: Partial<CertificateElement>) => {
    updateDesign((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === elementId ? { ...el, ...updates } as CertificateElement : el
      ),
    }));
  }, [updateDesign]);

  const addElement = useCallback((element: CertificateElement) => {
    updateDesign((prev) => ({
      ...prev,
      elements: [...prev.elements, element],
    }));
    setSelectedElementId(element.id);
  }, [updateDesign]);

  const removeElement = useCallback((elementId: string) => {
    updateDesign((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== elementId),
    }));
    if (selectedElementId === elementId) setSelectedElementId(null);
  }, [updateDesign, selectedElementId]);

  const moveElement = useCallback((elementId: string, direction: "up" | "down") => {
    updateDesign((prev) => {
      const idx = prev.elements.findIndex((el) => el.id === elementId);
      if (idx < 0) return prev;
      const newElements = [...prev.elements];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= newElements.length) return prev;
      [newElements[idx], newElements[swapIdx]] = [newElements[swapIdx], newElements[idx]];
      return { ...prev, elements: newElements };
    });
  }, [updateDesign]);

  const loadPreset = useCallback((preset: "classic" | "modern" | "elegant" | "corporate") => {
    const data = getPresetTemplate(preset);
    setDesign(data);
    setSelectedElementId(null);
    setSelectedTemplateId(null);
    setTemplateName(`${preset.charAt(0).toUpperCase() + preset.slice(1)} Template`);
  }, []);

  const loadTemplate = useCallback((template: Template) => {
    setSelectedTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(template.description || "");
    setDesign(template.design_data);
    setSelectedElementId(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const payload: Record<string, unknown> = {
        name: templateName,
        description: templateDescription,
        design_data: design,
      };

      let res: Response;
      if (selectedTemplateId) {
        payload.id = selectedTemplateId;
        res = await fetch("/api/certificates/templates", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/certificates/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save template");
      }

      const saved = await res.json();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      if (selectedTemplateId) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === selectedTemplateId ? { ...t, ...saved } : t))
        );
      } else {
        setSelectedTemplateId(saved.id);
        setTemplates((prev) => [saved, ...prev]);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while saving");
    } finally {
      setSaving(false);
    }
  }, [templateName, templateDescription, design, selectedTemplateId]);

  const handleSetDefault = useCallback(async () => {
    if (!selectedTemplateId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/certificates/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTemplateId, is_default: true }),
      });
      if (!res.ok) throw new Error("Failed to set as default");
      const saved = await res.json();
      setTemplates((prev) =>
        prev.map((t) => ({
          ...t,
          is_default: t.id === selectedTemplateId,
          ...(t.id === selectedTemplateId ? saved : {}),
        }))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [selectedTemplateId]);

  const handleExportPDF = useCallback(() => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Certificate Preview</title>
  <style>
    @page { size: ${design.dimensions.orientation === "landscape" ? "landscape" : "portrait"}; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f3f4f6; }
    @media print { html, body { background: #fff; } .no-print { display: none !important; } }
    .wrapper { width: ${design.dimensions.width}px; height: ${design.dimensions.height}px; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
    .wrapper svg { width: 100%; height: 100%; }
    .actions { position: fixed; top: 20px; right: 20px; display: flex; gap: 8px; z-index: 100; }
    .actions button { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-print { background: #4f46e5; color: #fff; }
    .btn-close { background: #e5e7eb; color: #374151; }
  </style>
</head>
<body>
  <div class="actions no-print">
    <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
    <button class="btn-close" onclick="window.close()">Close</button>
  </div>
  <div class="wrapper">${renderCertificateToSVG(design, sampleData)}</div>
</body>
</html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }, [design, sampleData]);

  const handleElementClick = useCallback((elementId: string) => {
    setSelectedElementId(elementId);
    setExpandedSection("elements");
  }, []);

  const toggleSection = (section: PanelSection) => {
    setExpandedSection((prev) => (prev === section ? prev : section));
  };

  // SVG preview with clickable elements
  const previewScale = 0.55;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left Panel - Properties */}
      <div className="w-[420px] flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
        {/* Template Name */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="h-5 w-5 text-indigo-600" />
            <h1 className="text-lg font-bold text-gray-900">Certificate Designer</h1>
          </div>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Template name"
          />
          <input
            type="text"
            value={templateDescription}
            onChange={(e) => setTemplateDescription(e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Description (optional)"
          />

          {/* Saved templates dropdown */}
          {templates.length > 0 && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Load saved template</label>
              <select
                value={selectedTemplateId || ""}
                onChange={(e) => {
                  const t = templates.find((t) => t.id === e.target.value);
                  if (t) loadTemplate(t);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select a template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_default ? "(Default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="divide-y divide-gray-200">
          {/* Presets Section */}
          <SectionHeader
            title="Preset Templates"
            icon={<Star className="h-4 w-4" />}
            expanded={expandedSection === "presets"}
            onClick={() => toggleSection("presets")}
          />
          {expandedSection === "presets" && (
            <div className="p-4 grid grid-cols-2 gap-2">
              {(["classic", "modern", "elegant", "corporate"] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => loadPreset(preset)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 p-3 text-sm hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                >
                  <div className={cn(
                    "h-16 w-full rounded border-2",
                    preset === "classic" && "border-amber-700 bg-amber-50",
                    preset === "modern" && "border-indigo-500 bg-white",
                    preset === "elegant" && "border-yellow-500 bg-stone-50",
                    preset === "corporate" && "border-slate-700 bg-slate-50",
                  )}>
                    <div className={cn(
                      "mt-2 mx-auto h-1.5 w-10 rounded",
                      preset === "classic" && "bg-amber-700",
                      preset === "modern" && "bg-indigo-500",
                      preset === "elegant" && "bg-yellow-500",
                      preset === "corporate" && "bg-slate-700",
                    )} />
                    <div className={cn(
                      "mt-1 mx-auto h-1 w-14 rounded",
                      preset === "classic" && "bg-amber-300",
                      preset === "modern" && "bg-indigo-200",
                      preset === "elegant" && "bg-yellow-300",
                      preset === "corporate" && "bg-slate-300",
                    )} />
                  </div>
                  <span className="font-medium capitalize text-gray-700">{preset}</span>
                </button>
              ))}
            </div>
          )}

          {/* Background Section */}
          <SectionHeader
            title="Background"
            icon={<Square className="h-4 w-4" />}
            expanded={expandedSection === "background"}
            onClick={() => toggleSection("background")}
          />
          {expandedSection === "background" && (
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={design.background.color}
                    onChange={(e) => updateDesign((d) => ({ ...d, background: { ...d.background, color: e.target.value } }))}
                    className="h-8 w-8 cursor-pointer rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={design.background.color}
                    onChange={(e) => updateDesign((d) => ({ ...d, background: { ...d.background, color: e.target.value } }))}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Pattern</label>
                <select
                  value={design.background.pattern}
                  onChange={(e) => updateDesign((d) => ({ ...d, background: { ...d.background, pattern: e.target.value as DesignData["background"]["pattern"] } }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="none">None</option>
                  <option value="classic">Classic (Ornate)</option>
                  <option value="modern">Modern (Minimal)</option>
                  <option value="elegant">Elegant (Gold)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Orientation</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateDesign((d) => ({
                      ...d,
                      dimensions: { ...d.dimensions, orientation: "landscape", width: 1056, height: 816 },
                    }))}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      design.dimensions.orientation === "landscape"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    Landscape
                  </button>
                  <button
                    onClick={() => updateDesign((d) => ({
                      ...d,
                      dimensions: { ...d.dimensions, orientation: "portrait", width: 816, height: 1056 },
                    }))}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      design.dimensions.orientation === "portrait"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    Portrait
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Background Image URL</label>
                <input
                  type="text"
                  value={design.background.image_url || ""}
                  onChange={(e) => updateDesign((d) => ({ ...d, background: { ...d.background, image_url: e.target.value || null } }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
          )}

          {/* Border Section */}
          <SectionHeader
            title="Border"
            icon={<Layers className="h-4 w-4" />}
            expanded={expandedSection === "border"}
            onClick={() => toggleSection("border")}
          />
          {expandedSection === "border" && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Enable Border</label>
                <button
                  onClick={() => updateDesign((d) => ({ ...d, border: { ...d.border, enabled: !d.border.enabled } }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    design.border.enabled ? "bg-indigo-600" : "bg-gray-300"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                    design.border.enabled ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
              {design.border.enabled && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.border.color}
                        onChange={(e) => updateDesign((d) => ({ ...d, border: { ...d.border, color: e.target.value } }))}
                        className="h-8 w-8 cursor-pointer rounded border border-gray-300"
                      />
                      <input
                        type="text"
                        value={design.border.color}
                        onChange={(e) => updateDesign((d) => ({ ...d, border: { ...d.border, color: e.target.value } }))}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Width</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={design.border.width}
                        onChange={(e) => updateDesign((d) => ({ ...d, border: { ...d.border, width: parseInt(e.target.value) || 1 } }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Padding</label>
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={design.border.padding}
                        onChange={(e) => updateDesign((d) => ({ ...d, border: { ...d.border, padding: parseInt(e.target.value) || 0 } }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Style</label>
                    <select
                      value={design.border.style}
                      onChange={(e) => updateDesign((d) => ({ ...d, border: { ...d.border, style: e.target.value as DesignData["border"]["style"] } }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="solid">Solid</option>
                      <option value="double">Double</option>
                      <option value="dashed">Dashed</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Elements Section */}
          <SectionHeader
            title="Elements"
            icon={<Type className="h-4 w-4" />}
            expanded={expandedSection === "elements"}
            onClick={() => toggleSection("elements")}
          />
          {expandedSection === "elements" && (
            <div className="p-4 space-y-3">
              {/* Add element buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => addElement(defaultTextElement())}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-3 w-3" /> Text
                </button>
                <button
                  onClick={() => addElement(defaultImageElement())}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-3 w-3" /> Image
                </button>
                <button
                  onClick={() => addElement(defaultLineElement())}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-3 w-3" /> Line
                </button>
                <button
                  onClick={() => addElement(defaultShapeElement())}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-3 w-3" /> Shape
                </button>
              </div>

              {/* Element list */}
              <div className="space-y-1">
                {design.elements.map((el, idx) => (
                  <div
                    key={el.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                      selectedElementId === el.id
                        ? "bg-indigo-50 border border-indigo-200"
                        : "hover:bg-gray-50 border border-transparent"
                    )}
                    onClick={() => setSelectedElementId(el.id)}
                  >
                    <span className="flex-shrink-0">
                      {el.type === "text" && <Type className="h-3.5 w-3.5 text-gray-400" />}
                      {el.type === "image" && <ImageIcon className="h-3.5 w-3.5 text-gray-400" />}
                      {el.type === "line" && <Minus className="h-3.5 w-3.5 text-gray-400" />}
                      {el.type === "shape" && <Square className="h-3.5 w-3.5 text-gray-400" />}
                    </span>
                    <span className="flex-1 truncate text-gray-700">
                      {el.type === "text" ? (el as TextElement).content.slice(0, 30) : el.id}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveElement(el.id, "up"); }}
                        className="p-0.5 text-gray-400 hover:text-gray-600"
                        title="Move up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveElement(el.id, "down"); }}
                        className="p-0.5 text-gray-400 hover:text-gray-600"
                        title="Move down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeElement(el.id); }}
                        className="p-0.5 text-gray-400 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {design.elements.length === 0 && (
                  <p className="text-sm text-gray-400 italic py-2">No elements. Add one above.</p>
                )}
              </div>

              {/* Selected element properties */}
              {selectedElement && (
                <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {selectedElement.type.charAt(0).toUpperCase() + selectedElement.type.slice(1)} Properties
                  </h4>

                  {selectedElement.type === "text" && (
                    <TextElementProperties
                      element={selectedElement as TextElement}
                      onChange={(updates) => updateElement(selectedElement.id, updates)}
                      templateVariables={templateVariables}
                      showVariableDropdown={showVariableDropdown}
                      setShowVariableDropdown={setShowVariableDropdown}
                    />
                  )}

                  {selectedElement.type === "image" && (
                    <ImageElementProperties
                      element={selectedElement as ImageElement}
                      onChange={(updates) => updateElement(selectedElement.id, updates)}
                    />
                  )}

                  {selectedElement.type === "line" && (
                    <LineElementProperties
                      element={selectedElement as LineElement}
                      onChange={(updates) => updateElement(selectedElement.id, updates)}
                    />
                  )}

                  {selectedElement.type === "shape" && (
                    <ShapeElementProperties
                      element={selectedElement as ShapeElement}
                      onChange={(updates) => updateElement(selectedElement.id, updates)}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Canvas Preview */}
      <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                previewMode
                  ? "bg-indigo-100 text-indigo-700"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              )}
            >
              <Eye className="h-4 w-4" />
              {previewMode ? "Preview On" : "Preview"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-sm text-red-600 mr-2">{error}</span>
            )}
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" /> Export PDF
            </button>
            {selectedTemplateId && (
              <button
                onClick={handleSetDefault}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Award className="h-4 w-4" /> Set as Default
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saveSuccess ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Saving..." : saveSuccess ? "Saved!" : "Save Template"}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          <div
            ref={previewRef}
            className="bg-white shadow-2xl rounded-lg overflow-hidden"
            style={{
              width: design.dimensions.width * previewScale,
              height: design.dimensions.height * previewScale,
            }}
          >
            <div
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: "top left",
                width: design.dimensions.width,
                height: design.dimensions.height,
                position: "relative",
              }}
            >
              {/* Render the SVG */}
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svgPreview) }} />

              {/* Clickable overlay for elements */}
              {design.elements.map((el) => {
                let style: React.CSSProperties = { position: "absolute", cursor: "pointer" };

                if (el.type === "text") {
                  const t = el as TextElement;
                  const estimatedWidth = t.content.length * t.fontSize * 0.6;
                  let left = t.x;
                  if (t.align === "center") left = t.x - estimatedWidth / 2;
                  else if (t.align === "right") left = t.x - estimatedWidth;
                  style = {
                    ...style,
                    left,
                    top: t.y - t.fontSize / 2,
                    width: estimatedWidth,
                    height: t.fontSize * 1.5,
                  };
                } else if (el.type === "image") {
                  const img = el as ImageElement;
                  style = { ...style, left: img.x, top: img.y, width: img.width, height: img.height };
                } else if (el.type === "line") {
                  const ln = el as LineElement;
                  const minX = Math.min(ln.x1, ln.x2);
                  const minY = Math.min(ln.y1, ln.y2);
                  const w = Math.abs(ln.x2 - ln.x1);
                  const h = Math.max(Math.abs(ln.y2 - ln.y1), 10);
                  style = { ...style, left: minX, top: minY, width: w, height: h };
                } else if (el.type === "shape") {
                  const sh = el as ShapeElement;
                  style = { ...style, left: sh.x, top: sh.y, width: sh.width, height: sh.height };
                }

                return (
                  <div
                    key={`overlay-${el.id}`}
                    style={style}
                    className={cn(
                      "hover:outline hover:outline-2 hover:outline-indigo-400 hover:outline-offset-2 rounded",
                      selectedElementId === el.id && "outline outline-2 outline-indigo-500 outline-offset-2"
                    )}
                    onClick={() => handleElementClick(el.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function SectionHeader({
  title,
  icon,
  expanded,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
    >
      {icon}
      <span className="flex-1 text-left">{title}</span>
      {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
    </button>
  );
}

function TextElementProperties({
  element,
  onChange,
  templateVariables,
  showVariableDropdown,
  setShowVariableDropdown,
}: {
  element: TextElement;
  onChange: (updates: Partial<TextElement>) => void;
  templateVariables: ReturnType<typeof getTemplateVariables>;
  showVariableDropdown: boolean;
  setShowVariableDropdown: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Content</label>
        <div className="relative">
          <input
            type="text"
            value={element.content}
            onChange={(e) => onChange({ content: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-8"
          />
          <button
            onClick={() => setShowVariableDropdown(!showVariableDropdown)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600"
            title="Insert variable"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        {showVariableDropdown && (
          <div className="mt-1 rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
            {templateVariables.map((v) => (
              <button
                key={v.key}
                onClick={() => {
                  onChange({ content: element.content + v.key });
                  setShowVariableDropdown(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors"
              >
                <span className="font-mono text-indigo-600 text-xs">{v.key}</span>
                <span className="block text-xs text-gray-500">{v.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">X</label>
          <input type="number" value={element.x} onChange={(e) => onChange({ x: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Y</label>
          <input type="number" value={element.y} onChange={(e) => onChange({ y: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Font Family</label>
        <select value={element.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value as TextElement["fontFamily"] })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="serif">Serif</option>
          <option value="sans-serif">Sans-Serif</option>
          <option value="monospace">Monospace</option>
        </select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Size</label>
          <input type="number" min={8} max={72} value={element.fontSize} onChange={(e) => onChange({ fontSize: parseInt(e.target.value) || 16 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Weight</label>
          <select value={element.fontWeight || "normal"} onChange={(e) => onChange({ fontWeight: e.target.value as TextElement["fontWeight"] })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Style</label>
          <select value={element.fontStyle || "normal"} onChange={(e) => onChange({ fontStyle: e.target.value as TextElement["fontStyle"] })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="normal">Normal</option>
            <option value="italic">Italic</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={element.color} onChange={(e) => onChange({ color: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-gray-300" />
          <input type="text" value={element.color} onChange={(e) => onChange({ color: e.target.value })} className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-mono" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Alignment</label>
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              onClick={() => onChange({ align: a })}
              className={cn(
                "flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                element.align === a ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageElementProperties({
  element,
  onChange,
}: {
  element: ImageElement;
  onChange: (updates: Partial<ImageElement>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Image URL</label>
        <input type="text" value={element.url} onChange={(e) => onChange({ url: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://... or {{company_logo}}" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">X</label>
          <input type="number" value={element.x} onChange={(e) => onChange({ x: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Y</label>
          <input type="number" value={element.y} onChange={(e) => onChange({ y: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Width</label>
          <input type="number" min={1} value={element.width} onChange={(e) => onChange({ width: parseInt(e.target.value) || 1 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Height</label>
          <input type="number" min={1} value={element.height} onChange={(e) => onChange({ height: parseInt(e.target.value) || 1 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
    </div>
  );
}

function LineElementProperties({
  element,
  onChange,
}: {
  element: LineElement;
  onChange: (updates: Partial<LineElement>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Start X</label>
          <input type="number" value={element.x1} onChange={(e) => onChange({ x1: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Start Y</label>
          <input type="number" value={element.y1} onChange={(e) => onChange({ y1: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">End X</label>
          <input type="number" value={element.x2} onChange={(e) => onChange({ x2: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">End Y</label>
          <input type="number" value={element.y2} onChange={(e) => onChange({ y2: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={element.strokeColor} onChange={(e) => onChange({ strokeColor: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-gray-300" />
          <input type="text" value={element.strokeColor} onChange={(e) => onChange({ strokeColor: e.target.value })} className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-mono" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Stroke Width</label>
        <input type="number" min={1} max={10} value={element.strokeWidth} onChange={(e) => onChange({ strokeWidth: parseInt(e.target.value) || 1 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
    </div>
  );
}

function ShapeElementProperties({
  element,
  onChange,
}: {
  element: ShapeElement;
  onChange: (updates: Partial<ShapeElement>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Shape</label>
        <select value={element.shape} onChange={(e) => onChange({ shape: e.target.value as ShapeElement["shape"] })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="rectangle">Rectangle</option>
          <option value="circle">Circle</option>
          <option value="ellipse">Ellipse</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">X</label>
          <input type="number" value={element.x} onChange={(e) => onChange({ x: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Y</label>
          <input type="number" value={element.y} onChange={(e) => onChange({ y: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Width</label>
          <input type="number" min={1} value={element.width} onChange={(e) => onChange({ width: parseInt(e.target.value) || 1 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Height</label>
          <input type="number" min={1} value={element.height} onChange={(e) => onChange({ height: parseInt(e.target.value) || 1 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Fill Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={element.fillColor} onChange={(e) => onChange({ fillColor: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-gray-300" />
          <input type="text" value={element.fillColor} onChange={(e) => onChange({ fillColor: e.target.value })} className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-mono" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Stroke Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={element.strokeColor} onChange={(e) => onChange({ strokeColor: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-gray-300" />
          <input type="text" value={element.strokeColor} onChange={(e) => onChange({ strokeColor: e.target.value })} className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-mono" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Stroke Width</label>
          <input type="number" min={0} max={10} value={element.strokeWidth} onChange={(e) => onChange({ strokeWidth: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Opacity</label>
          <input type="number" min={0} max={1} step={0.1} value={element.opacity} onChange={(e) => onChange({ opacity: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
    </div>
  );
}
