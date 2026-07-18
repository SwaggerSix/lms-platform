/**
 * Server-side validation of evaluation answers against the template's native
 * question definitions. Mirrors what the learner UI enforces client-side so a
 * crafted request can't record junk (unknown question ids, out-of-scale
 * ratings, options that don't exist, missing required answers).
 *
 * Templates without native questions (SurveyCraft-sourced or legacy templates
 * saved with `questions: []`) are not validated — there is nothing to
 * validate against.
 */

export interface TemplateQuestion {
  id: string;
  text?: string;
  type?: string;
  required?: boolean;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
}

const MAX_TEXT_ANSWER_LENGTH = 5000;

/** Returns an error message, or null when the answers are valid. */
export function validateEvaluationAnswers(
  questions: TemplateQuestion[],
  answers: Record<string, unknown>
): string | null {
  if (!Array.isArray(questions) || questions.length === 0) return null;

  const byId = new Map(questions.filter((q) => q?.id).map((q) => [q.id, q]));

  for (const key of Object.keys(answers)) {
    if (!byId.has(key)) {
      return `Answer references an unknown question (${key})`;
    }
  }

  for (const q of byId.values()) {
    const value = answers[q.id];
    const missing =
      value === undefined || value === null || value === "";
    if (missing) {
      if (q.required) {
        return `Missing answer for required question "${q.text ?? q.id}"`;
      }
      continue;
    }

    switch (q.type) {
      case "rating": {
        const min = q.scale_min ?? 1;
        const max = q.scale_max ?? 5;
        if (
          typeof value !== "number" ||
          !Number.isInteger(value) ||
          value < min ||
          value > max
        ) {
          return `Answer for "${q.text ?? q.id}" must be a whole number between ${min} and ${max}`;
        }
        break;
      }
      case "nps": {
        if (
          typeof value !== "number" ||
          !Number.isInteger(value) ||
          value < 0 ||
          value > 10
        ) {
          return `Answer for "${q.text ?? q.id}" must be a whole number between 0 and 10`;
        }
        break;
      }
      case "multiple_choice": {
        const options = Array.isArray(q.options) ? q.options : [];
        if (typeof value !== "string" || !options.includes(value)) {
          return `Answer for "${q.text ?? q.id}" must be one of the question's options`;
        }
        break;
      }
      case "yes_no": {
        if (value !== "yes" && value !== "no") {
          return `Answer for "${q.text ?? q.id}" must be "yes" or "no"`;
        }
        break;
      }
      case "text":
      default: {
        // Free text (and unknown legacy types degrade to text semantics).
        if (typeof value !== "string") {
          return `Answer for "${q.text ?? q.id}" must be text`;
        }
        if (value.length > MAX_TEXT_ANSWER_LENGTH) {
          return `Answer for "${q.text ?? q.id}" is too long (max ${MAX_TEXT_ANSWER_LENGTH} characters)`;
        }
        break;
      }
    }
  }

  return null;
}
