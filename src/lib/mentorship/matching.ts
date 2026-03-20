import { createServiceClient } from "@/lib/supabase/service";
import { getAI } from "@/lib/ai/openai";

export interface MentorMatch {
  mentorId: string;
  userId: string;
  name: string;
  expertiseAreas: string[];
  availability: string;
  yearsExperience: number;
  rating: number | null;
  totalReviews: number;
  bio: string | null;
  timezone: string | null;
  preferredMeetingFrequency: string;
  matchScore: number;
  matchReasons: string[];
  currentMenteeCount: number;
  maxMentees: number;
}

export interface MenteeProfile {
  userId: string;
  goals: string;
  preferredAreas: string[];
  skills: string[];
  experienceLevel: string;
}

/**
 * Calculate a match score (0-100) between a mentee and a mentor
 * based on skills overlap, availability, and experience.
 */
export function calculateMatchScore(
  mentee: { preferredAreas: string[]; goals: string; skills: string[] },
  mentor: {
    expertiseAreas: string[];
    availability: string;
    yearsExperience: number;
    rating: number | null;
    currentMenteeCount: number;
    maxMentees: number;
  }
): number {
  let score = 0;

  // Skills/area overlap (0-40 points)
  const menteeAreas = new Set(
    mentee.preferredAreas.map((a) => a.toLowerCase())
  );
  const menteeSkills = new Set(mentee.skills.map((s) => s.toLowerCase()));
  const mentorAreas = mentor.expertiseAreas.map((a) =>
    typeof a === "string" ? a.toLowerCase() : ""
  );

  let overlapCount = 0;
  for (const area of mentorAreas) {
    if (menteeAreas.has(area) || menteeSkills.has(area)) {
      overlapCount++;
    }
  }
  const overlapRatio =
    menteeAreas.size + menteeSkills.size > 0
      ? overlapCount / Math.max(menteeAreas.size, 1)
      : 0;
  score += Math.min(overlapRatio * 40, 40);

  // Availability (0-20 points)
  if (mentor.availability === "available") {
    score += 20;
  } else if (mentor.availability === "limited") {
    score += 10;
  }

  // Capacity (0-10 points)
  const capacityRatio =
    mentor.maxMentees > 0
      ? (mentor.maxMentees - mentor.currentMenteeCount) / mentor.maxMentees
      : 0;
  score += Math.max(capacityRatio * 10, 0);

  // Experience (0-15 points)
  const expScore = Math.min((mentor.yearsExperience || 0) / 10, 1) * 15;
  score += expScore;

  // Rating (0-15 points)
  if (mentor.rating !== null && mentor.rating > 0) {
    score += (mentor.rating / 5) * 15;
  } else {
    score += 7.5; // neutral score for unrated mentors
  }

  return Math.round(Math.min(score, 100) * 100) / 100;
}

/**
 * Find the best mentors for a mentee using rule-based scoring + optional AI analysis.
 */
export async function findBestMentors(
  menteeId: string,
  limit: number = 5
): Promise<MentorMatch[]> {
  const service = createServiceClient();

  // Get mentee info: user skills + any existing request goals
  const [userResult, skillsResult, requestResult] = await Promise.all([
    service.from("users").select("id, first_name, last_name, job_title").eq("id", menteeId).single(),
    service.from("user_skills").select("skill:skills!user_skills_skill_id_fkey(name)").eq("user_id", menteeId),
    service
      .from("mentorship_requests")
      .select("goals, preferred_areas")
      .eq("mentee_id", menteeId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const menteeSkills = (skillsResult.data ?? []).map(
    (s: any) => s.skill?.name ?? ""
  ).filter(Boolean);

  const latestRequest = requestResult.data?.[0];
  const menteeGoals = latestRequest?.goals ?? "";
  const preferredAreas = Array.isArray(latestRequest?.preferred_areas)
    ? latestRequest.preferred_areas
    : [];

  // Get all active mentor profiles with capacity
  const { data: mentors } = await service
    .from("mentor_profiles")
    .select(
      "id, user_id, expertise_areas, availability, max_mentees, current_mentee_count, bio, years_experience, timezone, preferred_meeting_frequency, rating, total_reviews, user:users!mentor_profiles_user_id_fkey(id, first_name, last_name)"
    )
    .eq("is_active", true)
    .neq("user_id", menteeId);

  if (!mentors || mentors.length === 0) return [];

  // Score each mentor
  const scored: MentorMatch[] = mentors
    .filter(
      (m: any) => m.current_mentee_count < m.max_mentees
    )
    .map((m: any) => {
      const expertiseAreas = Array.isArray(m.expertise_areas)
        ? m.expertise_areas
        : [];
      const matchScore = calculateMatchScore(
        { preferredAreas, goals: menteeGoals, skills: menteeSkills },
        {
          expertiseAreas,
          availability: m.availability,
          yearsExperience: m.years_experience ?? 0,
          rating: m.rating ? parseFloat(m.rating) : null,
          currentMenteeCount: m.current_mentee_count,
          maxMentees: m.max_mentees,
        }
      );

      const user = m.user as any;
      const mentorName =
        user?.first_name && user?.last_name
          ? `${user.first_name} ${user.last_name}`
          : "Mentor";

      // Build match reasons
      const reasons: string[] = [];
      const overlap = expertiseAreas.filter(
        (a: string) =>
          preferredAreas.some(
            (p: string) => p.toLowerCase() === a.toLowerCase()
          ) ||
          menteeSkills.some(
            (s: string) => s.toLowerCase() === a.toLowerCase()
          )
      );
      if (overlap.length > 0) {
        reasons.push(`Expertise matches: ${overlap.join(", ")}`);
      }
      if (m.availability === "available") {
        reasons.push("Currently available for mentoring");
      }
      if (m.years_experience && m.years_experience >= 5) {
        reasons.push(`${m.years_experience} years of experience`);
      }
      if (m.rating && parseFloat(m.rating) >= 4.0) {
        reasons.push(`Highly rated (${parseFloat(m.rating).toFixed(1)}/5)`);
      }

      return {
        mentorId: m.id,
        userId: m.user_id,
        name: mentorName,
        expertiseAreas,
        availability: m.availability,
        yearsExperience: m.years_experience ?? 0,
        rating: m.rating ? parseFloat(m.rating) : null,
        totalReviews: m.total_reviews,
        bio: m.bio,
        timezone: m.timezone,
        preferredMeetingFrequency: m.preferred_meeting_frequency ?? "weekly",
        matchScore,
        matchReasons: reasons,
        currentMenteeCount: m.current_mentee_count,
        maxMentees: m.max_mentees,
      };
    });

  // Sort by score descending
  scored.sort((a, b) => b.matchScore - a.matchScore);

  // If we have goals and enough mentors, use AI to refine top candidates
  const topCandidates = scored.slice(0, Math.min(limit * 2, scored.length));

  if (menteeGoals && topCandidates.length > 0) {
    try {
      const aiRefined = await refineWithAI(
        { goals: menteeGoals, preferredAreas, skills: menteeSkills },
        topCandidates
      );
      return aiRefined.slice(0, limit);
    } catch {
      // Fall back to rule-based scoring
    }
  }

  return topCandidates.slice(0, limit);
}

/**
 * Use Claude to refine match rankings based on goals analysis.
 */
async function refineWithAI(
  mentee: { goals: string; preferredAreas: string[]; skills: string[] },
  candidates: MentorMatch[]
): Promise<MentorMatch[]> {
  const client = getAI();

  const mentorSummaries = candidates.map((c, i) => ({
    index: i,
    name: c.name,
    expertise: c.expertiseAreas,
    experience: c.yearsExperience,
    bio: c.bio?.slice(0, 200) ?? "",
    rating: c.rating,
    baseScore: c.matchScore,
  }));

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    system: "You are a mentorship matching assistant. Given a mentee's goals and potential mentors, rank them by fit. Return a JSON array of objects with {index, adjustedScore (0-100), reason}. Only return valid JSON.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          menteeGoals: mentee.goals,
          menteeSkills: mentee.skills,
          preferredAreas: mentee.preferredAreas,
          mentors: mentorSummaries,
        }),
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  const content = response.content[0]?.type === "text" ? response.content[0].text : "[]";
  const parsed = JSON.parse(content) as Array<{
    index: number;
    adjustedScore: number;
    reason: string;
  }>;

  // Apply AI adjustments
  for (const adjustment of parsed) {
    if (
      adjustment.index >= 0 &&
      adjustment.index < candidates.length
    ) {
      // Blend AI score with rule-based score (60/40 weight)
      const original = candidates[adjustment.index].matchScore;
      candidates[adjustment.index].matchScore =
        Math.round((original * 0.4 + adjustment.adjustedScore * 0.6) * 100) /
        100;
      if (adjustment.reason) {
        candidates[adjustment.index].matchReasons.unshift(adjustment.reason);
      }
    }
  }

  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return candidates;
}
