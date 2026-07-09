"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Nasba {
  cpe_credits: number | null;
  field_of_study: string | null;
  knowledge_level: string | null;
  prerequisites: string | null;
  advance_prep: string | null;
  delivery_method: string | null;
}

interface OnePager {
  title: string;
  description: string;
  domain: string | null;
  durationText: string | null;
  difficulty: string | null;
  objectives: string[];
  nasba: Nasba | null;
}

export default function OnePagerClient({ data }: { data: OnePager }) {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #one-pager, #one-pager * { visibility: visible; }
          #one-pager { position: absolute; top: 0; left: 0; width: 100%; box-shadow: none !important; margin: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl px-4">
        <div className="no-print mb-4 flex items-center justify-between">
          <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Back to courses
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </button>
        </div>

        <div id="one-pager" className="rounded-xl bg-white p-10 shadow-sm">
          {/* Header */}
          <div className="border-b-2 border-primary-600 pb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">Course Overview</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">{data.title}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {data.domain && <span><strong className="text-gray-700">Domain:</strong> {data.domain}</span>}
              {data.durationText && <span><strong className="text-gray-700">Duration:</strong> {data.durationText}</span>}
              {data.difficulty && <span className="capitalize"><strong className="text-gray-700">Level:</strong> {data.difficulty}</span>}
            </div>
          </div>

          {/* Description */}
          {data.description && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Description</h2>
              <p className="text-sm leading-relaxed text-gray-700">{data.description}</p>
            </section>
          )}

          {/* Objectives */}
          {data.objectives.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Learning Objectives</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {data.objectives.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </section>
          )}

          {/* NASBA */}
          {data.nasba && (
            <section className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/60 p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-700">NASBA CPE Information</h2>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <Row label="CPE Credits" value={data.nasba.cpe_credits != null ? String(data.nasba.cpe_credits) : null} />
                <Row label="Field of Study" value={data.nasba.field_of_study} />
                <Row label="Knowledge Level" value={data.nasba.knowledge_level} />
                <Row label="Delivery Method" value={data.nasba.delivery_method} />
                <Row label="Prerequisites" value={data.nasba.prerequisites} />
                <Row label="Advance Preparation" value={data.nasba.advance_prep} />
              </dl>
            </section>
          )}

          <p className="mt-8 border-t border-gray-200 pt-3 text-[10px] text-gray-500">
            Generated {new Date().toLocaleDateString()} · This overview reflects current course data.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}
