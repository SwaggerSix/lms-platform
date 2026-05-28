-- Seed mentor recognition badges. Awarded automatically when a mentor's
-- completed-mentorship count crosses each threshold. WHERE NOT EXISTS keeps
-- the migration idempotent.
INSERT INTO badges (name, description, category, criteria)
SELECT 'First Mentee', 'Completed your first mentorship as a mentor.', 'mentorship', '{"type":"mentorship_completed_as_mentor","threshold":1}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name='First Mentee' AND category='mentorship');

INSERT INTO badges (name, description, category, criteria)
SELECT 'Veteran Mentor', 'Completed 5 mentorships as a mentor.', 'mentorship', '{"type":"mentorship_completed_as_mentor","threshold":5}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name='Veteran Mentor' AND category='mentorship');

INSERT INTO badges (name, description, category, criteria)
SELECT 'Champion Mentor', 'Completed 10 mentorships as a mentor.', 'mentorship', '{"type":"mentorship_completed_as_mentor","threshold":10}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM badges WHERE name='Champion Mentor' AND category='mentorship');
