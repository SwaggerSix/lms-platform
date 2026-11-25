-- The Art of Presentation: the store description (operator-approved copy,
-- 2026-11-25), the same in both stores. Replaces the placeholder written when
-- the products were created (migration 20261125170000).

UPDATE public.products
SET description = $copy$Most presentations fail before the speaker says a word: the plan was thin, the nerves took over, or the first hard question knocked everything off course. This course fixes those three things.

You'll learn to plan a session on a single page, settle yourself in the minute before you start, and answer tough questions without losing the room. Then you'll prove it. Record a real presentation, hand in your session plan and a self-review, and get written feedback from an assessor on each one.

What you get
• Self-paced online course with a final exam
• Practical job aids to keep, including a session plan on a page, a pre-session checklist and a question toolkit
• A capstone marked by an assessor, with one chance to resubmit any piece
• A certificate when you pass$copy$,
    updated_at = now()
WHERE course_id IN ('79b0065c-2145-471c-a68c-9a58dd4ae70f', '732c1d60-5c4e-4618-83fb-fd9f33eee4de');
