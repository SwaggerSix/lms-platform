// Course → recommended psychometric self-assessment mapping.
//
// Source of truth: the researched course-mapping matrix shipped with the
// SurveyCraft instrument catalog (surveycraft repo,
// prisma/data/psychometric/course_mapping_matrix.csv — a copy lives at
// docs/assessments-course-mapping-matrix.csv in this repo). Each theme rule
// below corresponds to one row of that matrix; keywords are drawn from the
// theme name and the matrix's example course titles.
//
// Matching is intentionally dumb-but-transparent: a course matches a theme
// when any keyword appears in its title, category name, or tags
// (case-insensitive substring). Multiple themes can match; recommendations
// are deduplicated in theme order and capped.
//
// `AVAILABLE_INSTRUMENT_CODES` lists the instruments actually imported into
// SurveyCraft as ready-to-take master surveys (17 verified public-domain
// instruments as of 2026-07). Codes referenced by theme rules but not in
// this set (e.g. SSEIS-33, JSS-36 — pending item-text verification against
// their primary sources) are silently omitted from results; adding a code
// here after its SurveyCraft import unlocks it everywhere at once.

export interface InstrumentInfo {
  code: string;
  name: string;
  /** One-line learner-facing description of what it measures. */
  measures: string;
}

export interface RecommendedInstrument extends InstrumentInfo {
  /** The matched theme, for display ("Recommended for Stress & Resilience courses"). */
  theme: string;
}

export const INSTRUMENT_INFO: Record<string, InstrumentInfo> = {
  "IPIP-50": { code: "IPIP-50", name: "Big Five Personality (IPIP-50)", measures: "Your Big Five personality profile: extraversion, agreeableness, conscientiousness, emotional stability, and openness." },
  "PSS-10": { code: "PSS-10", name: "Perceived Stress Scale (PSS-10)", measures: "How stressful you've found the last month." },
  "WHO-5": { code: "WHO-5", name: "WHO-5 Well-Being Index", measures: "Your overall psychological well-being over the last two weeks." },
  "BRS-6": { code: "BRS-6", name: "Brief Resilience Scale (BRS)", measures: "How quickly you bounce back from stress and setbacks." },
  "GSE-10": { code: "GSE-10", name: "General Self-Efficacy Scale (GSE)", measures: "Your confidence in your ability to handle challenges." },
  "RSES-10": { code: "RSES-10", name: "Rosenberg Self-Esteem Scale", measures: "Your global self-esteem." },
  "SWLS-5": { code: "SWLS-5", name: "Satisfaction With Life Scale (SWLS)", measures: "How satisfied you are with your life overall." },
  "LOTR-10": { code: "LOTR-10", name: "Life Orientation Test (LOT-R)", measures: "Your dispositional optimism." },
  "GQ-6": { code: "GQ-6", name: "Gratitude Questionnaire (GQ-6)", measures: "Your dispositional gratitude." },
  "GRIT-8": { code: "GRIT-8", name: "Short Grit Scale (Grit-S)", measures: "Your perseverance and passion for long-term goals." },
  "GMS-8": { code: "GMS-8", name: "Growth Mindset Scale", measures: "Whether you see ability as fixed or growable." },
  "TPS-7": { code: "TPS-7", name: "Team Psychological Safety Scale", measures: "How safe your team feels for interpersonal risk-taking (Edmondson)." },
  "TEQ-16": { code: "TEQ-16", name: "Toronto Empathy Questionnaire", measures: "Your overall empathy." },
  "CBI-19": { code: "CBI-19", name: "Copenhagen Burnout Inventory", measures: "Personal, work-related, and client-related burnout." },
  "UWES-9": { code: "UWES-9", name: "Utrecht Work Engagement Scale (UWES-9)", measures: "Your vigor, dedication, and absorption at work." },
  "MAAS-15": { code: "MAAS-15", name: "Mindful Attention Awareness Scale", measures: "Your present-moment attention and awareness." },
  "GTL-7": { code: "GTL-7", name: "Global Transformational Leadership Scale", measures: "Transformational leadership behaviors — great as a pre/post measure." },
  // Pending item-text verification in SurveyCraft (kept here so theme rules
  // can already reference them; omitted from results until listed in
  // AVAILABLE_INSTRUMENT_CODES):
  "BFI-44": { code: "BFI-44", name: "Big Five Inventory (BFI-44)", measures: "Big Five personality traits." },
  "DISC-OSPP": { code: "DISC-OSPP", name: "Open-Source DISC", measures: "DISC behavioral style." },
  "VIA-IPIP48": { code: "VIA-IPIP48", name: "Character Strengths (IPIP-VIA)", measures: "Your top character strengths." },
  "ENN-FREE": { code: "ENN-FREE", name: "Enneagram-Style Assessment", measures: "Your dominant Enneagram type." },
  "ONET-IPSF": { code: "ONET-IPSF", name: "O*NET Interest Profiler", measures: "Your RIASEC career interests." },
  "RIASEC-PD": { code: "RIASEC-PD", name: "RIASEC Marker Scales", measures: "Your vocational interest profile." },
  "CONFLICT-ADKINS": { code: "CONFLICT-ADKINS", name: "Conflict Management Styles", measures: "Your preferred conflict-handling style." },
  "IRI-28": { code: "IRI-28", name: "Interpersonal Reactivity Index", measures: "Four dimensions of empathy." },
  "SSEIS-33": { code: "SSEIS-33", name: "Schutte Emotional Intelligence Scale", measures: "Trait emotional intelligence." },
  "JSS-36": { code: "JSS-36", name: "Job Satisfaction Survey (JSS)", measures: "Satisfaction across nine job facets." },
  "SCS-SF-12": { code: "SCS-SF-12", name: "Self-Compassion Scale (Short Form)", measures: "How kindly you treat yourself in hard times." },
  "PVQ-21": { code: "PVQ-21", name: "Portrait Values Questionnaire", measures: "Your ten basic personal values (Schwartz)." },
  "IPC-24": { code: "IPC-24", name: "Levenson Locus of Control", measures: "Internal vs. external locus of control." },
  "NCS-18": { code: "NCS-18", name: "Need for Cognition Scale", measures: "How much you enjoy effortful thinking." },
  "MDMQ-28": { code: "MDMQ-28", name: "Melbourne Decision Making Questionnaire", measures: "Your decision-making style and coping patterns." },
  "GPS-20": { code: "GPS-20", name: "General Procrastination Scale", measures: "Your trait procrastination." },
  "SFCQ-10": { code: "SFCQ-10", name: "Cultural Intelligence Scale (Short Form)", measures: "Your cultural intelligence (CQ)." },
  "ILS-44": { code: "ILS-44", name: "Index of Learning Styles", measures: "Your learning-style preferences (frame as self-reflection, not prescription)." },
  "MI-BB": { code: "MI-BB", name: "Multiple Intelligences Assessment", measures: "Your dominant intelligences (Gardner framework)." },
  "RFOC-SHORT": { code: "RFOC-SHORT", name: "Readiness for Organizational Change", measures: "Individual readiness for a specific change." },
};

/** Instruments imported into SurveyCraft as ready-to-take master surveys. */
export const AVAILABLE_INSTRUMENT_CODES: ReadonlySet<string> = new Set([
  "IPIP-50", "PSS-10", "WHO-5", "BRS-6", "GSE-10", "RSES-10", "SWLS-5",
  "LOTR-10", "GQ-6", "GRIT-8", "GMS-8", "TPS-7", "TEQ-16", "CBI-19",
  "UWES-9", "MAAS-15", "GTL-7",
]);

interface ThemeRule {
  theme: string;
  /** Lowercase substrings matched against title + category + tags. */
  keywords: string[];
  /** Instrument codes in recommendation order (matrix order). */
  codes: string[];
}

// One rule per course_mapping_matrix.csv row, in matrix order.
export const THEME_RULES: ThemeRule[] = [
  {
    theme: "Leadership & Management",
    keywords: ["leadership", "leading", "manager", "managing managers", "situational leadership", "coaching skills for leaders", "leadership legacy", "leadership presence"],
    codes: ["GTL-7", "VIA-IPIP48", "IPIP-50", "GMS-8", "IPC-24"],
  },
  {
    theme: "Self-Awareness & Style",
    keywords: ["mbti", "disc", "enneagram", "strengthsfinder", "understanding yourself", "signature talents", "cohesive teams"],
    codes: ["IPIP-50", "DISC-OSPP", "ENN-FREE", "VIA-IPIP48"],
  },
  {
    theme: "Team Effectiveness",
    keywords: ["psychological safety", "high performing team", "team trust", "team building", "group structure", "cohesion", "vision and the team"],
    codes: ["TPS-7", "UWES-9", "DISC-OSPP"],
  },
  {
    theme: "Communication & Conflict",
    keywords: ["conflict", "difficult conversations", "listening", "mediation"],
    codes: ["CONFLICT-ADKINS", "TEQ-16", "IRI-28", "SSEIS-33"],
  },
  {
    theme: "Emotional Intelligence",
    keywords: ["emotional intelligence", "empathy", "influencing without authority", "social & emotional"],
    codes: ["SSEIS-33", "TEQ-16", "IRI-28", "MAAS-15"],
  },
  {
    theme: "Stress, Resilience & Wellness",
    keywords: ["stress", "burnout", "resilience", "wellness", "compassion fatigue", "staying focused", "well-being", "wellbeing"],
    codes: ["PSS-10", "CBI-19", "BRS-6", "WHO-5", "SCS-SF-12", "MAAS-15", "SWLS-5", "LOTR-10", "GQ-6"],
  },
  {
    theme: "Engagement & Motivation",
    keywords: ["engagement", "motivating", "motivation", "satisfaction"],
    codes: ["UWES-9", "JSS-36", "GRIT-8", "GQ-6"],
  },
  {
    theme: "Change & Innovation",
    keywords: ["change", "innovation", "overcome resistance", "creativity"],
    codes: ["RFOC-SHORT", "GMS-8", "IPIP-50", "NCS-18"],
  },
  {
    theme: "Decision-Making & Productivity",
    keywords: ["critical thinking", "decision making", "decision-making", "procrastination", "time and priority", "priorities", "cognitive bias", "problem solving"],
    codes: ["NCS-18", "MDMQ-28", "GPS-20", "IPC-24"],
  },
  {
    theme: "Diversity, Culture & Values",
    keywords: ["cultural intelligence", "multi-cultural", "multicultural", "multi-generational", "diverse workforce", "unconscious bias", "organizational values", "diversity", "inclusion", "equity"],
    codes: ["SFCQ-10", "PVQ-21", "IRI-28"],
  },
  {
    theme: "Coaching & Career Development",
    keywords: ["coaching", "mentoring", "succession planning", "career", "professional development"],
    codes: ["ONET-IPSF", "RIASEC-PD", "GSE-10", "GRIT-8", "GMS-8", "RSES-10", "VIA-IPIP48"],
  },
  {
    theme: "Learning & Development",
    keywords: ["train-the-trainer", "cognitive diversity", "work styles", "learning styles", "learning & development"],
    codes: ["ILS-44", "MI-BB", "NCS-18"],
  },
  {
    theme: "HR & Workforce",
    keywords: ["employee relations", "hr analytics", "hr operations", "human resources"],
    codes: ["JSS-36", "UWES-9", "WHO-5"],
  },
];

const MAX_RECOMMENDATIONS = 4;

export interface CourseSignals {
  title: string;
  categoryName?: string | null;
  tags?: string[] | null;
}

/**
 * Recommend ready-to-take self-assessments for a course, by matching the
 * course's title/category/tags against the theme rules. Only instruments
 * already imported into SurveyCraft (AVAILABLE_INSTRUMENT_CODES) are
 * returned; capped at MAX_RECOMMENDATIONS, deduplicated, matrix order.
 */
export function getRecommendedInstruments(course: CourseSignals): RecommendedInstrument[] {
  const haystack = [course.title, course.categoryName ?? "", ...(course.tags ?? [])]
    .join(" ")
    .toLowerCase();

  const results: RecommendedInstrument[] = [];
  const seen = new Set<string>();

  for (const rule of THEME_RULES) {
    if (!rule.keywords.some((k) => haystack.includes(k))) continue;
    for (const code of rule.codes) {
      if (seen.has(code) || !AVAILABLE_INSTRUMENT_CODES.has(code)) continue;
      const info = INSTRUMENT_INFO[code];
      if (!info) continue;
      seen.add(code);
      results.push({ ...info, theme: rule.theme });
      if (results.length >= MAX_RECOMMENDATIONS) return results;
    }
  }
  return results;
}
