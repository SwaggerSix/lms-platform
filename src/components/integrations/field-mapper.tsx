"use client";

import { useState, useCallback } from "react";
import {
  ArrowRight,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/utils/cn";

// ─── Types ───────────────────────────────────────────────────────

export interface FieldMappingItem {
  id?: string;
  source_field: string;
  target_field: string;
  transform: string | null;
  is_active: boolean;
}

interface FieldMapperProps {
  integrationId: string;
  provider: string;
  mappings: FieldMappingItem[];
  onSave: (mappings: FieldMappingItem[]) => Promise<void>;
}

// ─── Common fields by provider ──────────────────────────────────

const SOURCE_FIELDS: Record<string, string[]> = {
  bamboohr: [
    "firstName", "lastName", "workEmail", "jobTitle", "department",
    "division", "location", "supervisor", "hireDate", "status",
    "employeeNumber", "mobilePhone", "workPhone",
  ],
  workday: [
    "firstName", "lastName", "primaryWorkEmail", "businessTitle",
    "supervisoryOrganization", "hireDate", "status", "workerID",
    "location", "costCenter", "managementLevel",
  ],
  adp: [
    "givenName", "familyName1", "emailUri", "jobTitle", "department",
    "hireDate", "statusCode", "workerID", "positionTitle", "location",
  ],
  salesforce: [
    "FirstName", "LastName", "Email", "Title", "Account.Name",
    "Phone", "Department", "MailingCity", "LeadSource",
  ],
  hubspot: [
    "firstname", "lastname", "email", "jobtitle", "company",
    "phone", "city", "lifecyclestage", "hs_lead_status",
  ],
  custom_webhook: [
    "first_name", "last_name", "email", "job_title", "department",
    "hire_date", "status", "phone", "location",
  ],
};

const TARGET_FIELDS = [
  "first_name", "last_name", "email", "job_title", "department",
  "hire_date", "status", "phone", "location", "manager_email",
  "employee_id", "organization",
];

const TRANSFORMS = [
  { value: "", label: "None" },
  { value: "lowercase", label: "Lowercase" },
  { value: "uppercase", label: "Uppercase" },
  { value: "trim", label: "Trim whitespace" },
  { value: "boolean", label: "To Boolean" },
  { value: "string", label: "To String" },
];

// ─── Component ──────────────────────────────────────────────────

export default function FieldMapper({ integrationId, provider, mappings: initialMappings, onSave }: FieldMapperProps) {
  const [mappings, setMappings] = useState<FieldMappingItem[]>(
    initialMappings.length > 0 ? initialMappings : getDefaultMappings(provider)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const sourceFields = SOURCE_FIELDS[provider] || SOURCE_FIELDS.custom_webhook;

  const addMapping = useCallback(() => {
    setMappings((prev) => [
      ...prev,
      { source_field: "", target_field: "", transform: null, is_active: true },
    ]);
  }, []);

  const removeMapping = useCallback((index: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateMapping = useCallback((index: number, field: keyof FieldMappingItem, value: any) => {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }, []);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    setMappings((prev) => {
      const newMappings = [...prev];
      const [removed] = newMappings.splice(dragIndex, 1);
      newMappings.splice(index, 0, removed);
      return newMappings;
    });
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const handleSave = async () => {
    setError(null);

    // Validate: check for empty fields
    const invalid = mappings.filter((m) => m.is_active && (!m.source_field || !m.target_field));
    if (invalid.length > 0) {
      setError("All active mappings must have both source and target fields");
      return;
    }

    setSaving(true);
    try {
      await onSave(mappings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mappings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Field Mappings</h3>
          <p className="text-xs text-gray-500">Map source fields from your provider to LMS user fields</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addMapping}
            className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Mapping
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Mappings
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[24px_1fr_24px_1fr_120px_40px] gap-2 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <div />
        <div>Source Field</div>
        <div />
        <div>Target Field</div>
        <div>Transform</div>
        <div />
      </div>

      {/* Mapping rows */}
      <div className="space-y-1">
        {mappings.map((mapping, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "grid grid-cols-[24px_1fr_24px_1fr_120px_40px] gap-2 items-center rounded-md border px-2 py-2 transition-all",
              mapping.is_active
                ? "bg-white border-gray-200"
                : "bg-gray-50 border-gray-100 opacity-60",
              dragIndex === index && "ring-2 ring-blue-300 shadow-sm"
            )}
          >
            <button className="cursor-grab text-gray-300 hover:text-gray-500" title="Drag to reorder">
              <GripVertical className="h-4 w-4" />
            </button>

            <select
              value={mapping.source_field}
              onChange={(e) => updateMapping(index, "source_field", e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
            >
              <option value="">Select source...</option>
              {sourceFields.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
              <option value="__custom">Custom...</option>
            </select>

            <ArrowRight className="h-4 w-4 text-gray-300" />

            <select
              value={mapping.target_field}
              onChange={(e) => updateMapping(index, "target_field", e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
            >
              <option value="">Select target...</option>
              {TARGET_FIELDS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <select
              value={mapping.transform || ""}
              onChange={(e) => updateMapping(index, "transform", e.target.value || null)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
            >
              {TRANSFORMS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <button
              onClick={() => removeMapping(index)}
              className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Remove mapping"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {mappings.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center">
          <p className="text-sm text-gray-400">No field mappings configured</p>
          <button
            onClick={addMapping}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Add your first mapping
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Default mappings ───────────────────────────────────────────

function getDefaultMappings(provider: string): FieldMappingItem[] {
  const defaults: Record<string, FieldMappingItem[]> = {
    bamboohr: [
      { source_field: "firstName", target_field: "first_name", transform: null, is_active: true },
      { source_field: "lastName", target_field: "last_name", transform: null, is_active: true },
      { source_field: "workEmail", target_field: "email", transform: "lowercase", is_active: true },
      { source_field: "jobTitle", target_field: "job_title", transform: null, is_active: true },
      { source_field: "hireDate", target_field: "hire_date", transform: null, is_active: true },
    ],
    workday: [
      { source_field: "firstName", target_field: "first_name", transform: null, is_active: true },
      { source_field: "lastName", target_field: "last_name", transform: null, is_active: true },
      { source_field: "primaryWorkEmail", target_field: "email", transform: "lowercase", is_active: true },
      { source_field: "businessTitle", target_field: "job_title", transform: null, is_active: true },
      { source_field: "hireDate", target_field: "hire_date", transform: null, is_active: true },
    ],
    adp: [
      { source_field: "givenName", target_field: "first_name", transform: null, is_active: true },
      { source_field: "familyName1", target_field: "last_name", transform: null, is_active: true },
      { source_field: "emailUri", target_field: "email", transform: "lowercase", is_active: true },
      { source_field: "jobTitle", target_field: "job_title", transform: null, is_active: true },
      { source_field: "hireDate", target_field: "hire_date", transform: null, is_active: true },
    ],
    salesforce: [
      { source_field: "FirstName", target_field: "first_name", transform: null, is_active: true },
      { source_field: "LastName", target_field: "last_name", transform: null, is_active: true },
      { source_field: "Email", target_field: "email", transform: "lowercase", is_active: true },
      { source_field: "Title", target_field: "job_title", transform: null, is_active: true },
    ],
    hubspot: [
      { source_field: "firstname", target_field: "first_name", transform: null, is_active: true },
      { source_field: "lastname", target_field: "last_name", transform: null, is_active: true },
      { source_field: "email", target_field: "email", transform: "lowercase", is_active: true },
      { source_field: "jobtitle", target_field: "job_title", transform: null, is_active: true },
    ],
  };

  return defaults[provider] || [
    { source_field: "first_name", target_field: "first_name", transform: null, is_active: true },
    { source_field: "last_name", target_field: "last_name", transform: null, is_active: true },
    { source_field: "email", target_field: "email", transform: "lowercase", is_active: true },
  ];
}
