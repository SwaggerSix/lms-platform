import { describe, it, expect } from "vitest";
import { validateEvaluationAnswers } from "@/lib/evaluations/validate-answers";

const QUESTIONS = [
  { id: "q1", text: "Overall rating", type: "rating", required: true, scale_min: 1, scale_max: 5 },
  { id: "q2", text: "Recommend us?", type: "nps", required: true },
  { id: "q3", text: "Format", type: "multiple_choice", required: false, options: ["Live", "Self-paced"] },
  { id: "q4", text: "Would attend again", type: "yes_no", required: true },
  { id: "q5", text: "Comments", type: "text", required: false },
];

describe("validateEvaluationAnswers", () => {
  it("accepts a fully valid submission", () => {
    expect(
      validateEvaluationAnswers(QUESTIONS, {
        q1: 4,
        q2: 9,
        q3: "Live",
        q4: "yes",
        q5: "Great course",
      })
    ).toBeNull();
  });

  it("skips validation when the template has no native questions", () => {
    expect(validateEvaluationAnswers([], { anything: "goes" })).toBeNull();
  });

  it("rejects answers for unknown question ids", () => {
    expect(
      validateEvaluationAnswers(QUESTIONS, { q1: 4, q2: 9, q4: "yes", bogus: 1 })
    ).toMatch(/unknown question/);
  });

  it("rejects missing required answers but tolerates missing optional ones", () => {
    expect(
      validateEvaluationAnswers(QUESTIONS, { q1: 4, q2: 9 })
    ).toMatch(/required question/);
    expect(
      validateEvaluationAnswers(QUESTIONS, { q1: 4, q2: 9, q4: "no" })
    ).toBeNull();
  });

  it("rejects out-of-scale ratings and non-integers", () => {
    expect(
      validateEvaluationAnswers(QUESTIONS, { q1: 6, q2: 9, q4: "yes" })
    ).toMatch(/between 1 and 5/);
    expect(
      validateEvaluationAnswers(QUESTIONS, { q1: 3.5, q2: 9, q4: "yes" })
    ).toMatch(/between 1 and 5/);
    expect(
      validateEvaluationAnswers(QUESTIONS, { q1: "4", q2: 9, q4: "yes" })
    ).toMatch(/between 1 and 5/);
  });

  it("rejects NPS outside 0-10", () => {
    expect(
      validateEvaluationAnswers(QUESTIONS, { q1: 4, q2: 11, q4: "yes" })
    ).toMatch(/between 0 and 10/);
  });

  it("rejects multiple-choice values not in the options", () => {
    expect(
      validateEvaluationAnswers(QUESTIONS, { q1: 4, q2: 9, q3: "Hybrid", q4: "yes" })
    ).toMatch(/one of the question's options/);
  });

  it("rejects yes/no values outside yes|no", () => {
    expect(
      validateEvaluationAnswers(QUESTIONS, { q1: 4, q2: 9, q4: "maybe" })
    ).toMatch(/"yes" or "no"/);
  });

  it("rejects non-string and oversized text answers", () => {
    expect(
      validateEvaluationAnswers(QUESTIONS, { q1: 4, q2: 9, q4: "yes", q5: 42 })
    ).toMatch(/must be text/);
    expect(
      validateEvaluationAnswers(QUESTIONS, { q1: 4, q2: 9, q4: "yes", q5: "x".repeat(5001) })
    ).toMatch(/too long/);
  });
});
