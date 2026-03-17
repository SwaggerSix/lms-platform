"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Star,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Skill {
  name: string;
  proficiency: number;
  source: string;
  lastAssessed: string;
}

export interface SkillCategory {
  name: string;
  skills: Skill[];
}

export interface SkillGap {
  skill: string;
  current: number;
  target: number;
  gap: number;
  recommendedCourse: string;
}

export interface RadarCategory {
  label: string;
  value: number;
}

export interface SkillsData {
  userId: string;
  categories: SkillCategory[];
  skillGaps: SkillGap[];
  radarCategories: RadarCategory[];
  jobTitle: string;
}

/* ------------------------------------------------------------------ */
/*  Static Data                                                        */
/* ------------------------------------------------------------------ */

const SOURCE_COLORS: Record<string, string> = {
  Assessment: "bg-indigo-100 text-indigo-700",
  "Course Completion": "bg-green-100 text-green-700",
  "Self Reported": "bg-gray-100 text-gray-600",
  "Manager Review": "bg-purple-100 text-purple-700",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SkillsClient({ data }: { data: SkillsData }) {
  const [expandedCategory, setExpandedCategory] = useState<string>(
    data.categories.length > 0 ? data.categories[0].name : ""
  );
  const [showAssessModal, setShowAssessModal] = useState(false);
  const [assessSkill, setAssessSkill] = useState("");
  const [assessRating, setAssessRating] = useState(0);
  const [assessNotes, setAssessNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleSubmitAssessment = async () => {
    if (!assessSkill || assessRating === 0) {
      setSubmitError("Please select a skill and rating.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const supabase = createClient();
      // Look up the skill id by name
      const { data: skillRow, error: skillErr } = await supabase
        .from("skills")
        .select("id")
        .eq("name", assessSkill)
        .single();
      if (skillErr || !skillRow) throw new Error("Skill not found");

      const { error } = await supabase.from("user_skills").upsert(
        {
          user_id: data.userId,
          skill_id: skillRow.id,
          proficiency_level: assessRating,
          source: "Self Reported",
          notes: assessNotes || null,
          assessed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,skill_id" }
      );
      if (error) throw error;
      setShowAssessModal(false);
      setAssessSkill("");
      setAssessRating(0);
      setAssessNotes("");
      // Reload to reflect new data
      window.location.reload();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = (name: string) => {
    setExpandedCategory((prev) => (prev === name ? "" : name));
  };

  // Radar chart geometry
  const radarSize = 240;
  const center = radarSize / 2;
  const maxRadius = center - 20;
  const sides = data.radarCategories.length;

  const getPoint = (index: number, radius: number) => {
    const angle = (Math.PI * 2 * index) / sides - Math.PI / 2;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = data.radarCategories.map((cat, i) => getPoint(i, (cat.value / 100) * maxRadius));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Self-Assessment Modal */}
      {showAssessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div role="dialog" aria-modal="true" aria-label="Self-Assessment" className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Self-Assessment</h3>
              <button onClick={() => setShowAssessModal(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close self-assessment dialog">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Skill</label>
                <select
                  value={assessSkill}
                  onChange={(e) => setAssessSkill(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select a skill...</option>
                  {data.categories.flatMap((c) => c.skills).map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setAssessRating(rating)}
                      className="p-1"
                    >
                      <Star
                        className={cn(
                          "h-8 w-8 transition-colors",
                          rating <= assessRating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={assessNotes}
                  onChange={(e) => setAssessNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes about your proficiency..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              {submitError && (
                <p className="text-sm text-red-600">{submitError}</p>
              )}
              <button
                onClick={handleSubmitAssessment}
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Assessment
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Skills</h1>
            <p className="mt-1 text-sm text-gray-500">Track your skill development and identify growth areas.</p>
          </div>
          <button
            onClick={() => setShowAssessModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Star className="h-4 w-4" />
            Self-Assess
          </button>
        </div>

        {/* ---- Radar Chart ---- */}
        <div className="mt-6 flex justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="relative">
            <svg width={radarSize} height={radarSize} viewBox={`0 0 ${radarSize} ${radarSize}`}>
              {/* Grid levels */}
              {gridLevels.map((level, i) => {
                const points = Array.from({ length: sides }, (_, idx) => {
                  const p = getPoint(idx, level * maxRadius);
                  return `${p.x},${p.y}`;
                }).join(" ");
                return (
                  <polygon key={i} points={points} fill="none" stroke="#e5e7eb" strokeWidth={1} />
                );
              })}
              {/* Axis lines */}
              {Array.from({ length: sides }, (_, idx) => {
                const p = getPoint(idx, maxRadius);
                return <line key={idx} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth={1} />;
              })}
              {/* Data polygon */}
              <path d={dataPath} fill="rgba(99, 102, 241, 0.2)" stroke="#6366f1" strokeWidth={2} />
              {/* Data points */}
              {dataPoints.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.y} r={4} fill="#6366f1" />
              ))}
            </svg>
            {/* Labels */}
            {data.radarCategories.map((cat, idx) => {
              const p = getPoint(idx, maxRadius + 18);
              return (
                <span
                  key={cat.label}
                  className="absolute text-xs font-medium text-gray-600"
                  style={{ left: p.x, top: p.y, transform: "translate(-50%, -50%)" }}
                >
                  {cat.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* ---- Skills by Category (Accordion) ---- */}
        <div className="mt-8 space-y-3">
          {data.categories.map((category) => {
            const isExpanded = expandedCategory === category.name;
            return (
              <div key={category.name} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <button
                  onClick={() => toggleCategory(category.name)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{category.name}</h3>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      {category.skills.length} skills
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {category.skills.map((skill) => (
                      <div key={skill.name} className="flex items-center justify-between px-6 py-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-900">{skill.name}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", SOURCE_COLORS[skill.source])}>
                              {skill.source}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">Last assessed: {skill.lastAssessed}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-700">{skill.proficiency}/5</span>
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(skill.proficiency / 5) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ---- Skill Gap Analysis ---- */}
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Skill Gap Analysis</h2>
            <p className="mt-0.5 text-sm text-gray-500">Role: {data.jobTitle}</p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Skill</th>
                  <th className="pb-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Current Level</th>
                  <th className="pb-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Target Level</th>
                  <th className="pb-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Gap</th>
                  <th className="pb-3 pl-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Recommended Course</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.skillGaps.map((gap) => (
                  <tr key={gap.skill} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 text-sm font-medium text-gray-900">{gap.skill}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(gap.current / 5) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{gap.current}/5</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${(gap.target / 5) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{gap.target}/5</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", gap.gap > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
                        {gap.gap > 0 ? `-${gap.gap}` : "Met"}
                      </span>
                    </td>
                    <td className="py-3 pl-4">
                      <a href="#" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                        {gap.recommendedCourse}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
