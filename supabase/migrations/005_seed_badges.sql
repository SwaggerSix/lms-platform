-- ============================================
-- Seed default badges for the gamification system
-- Only inserts if the badges table is empty
-- ============================================

INSERT INTO badges (name, description, image_url, criteria, category)
SELECT * FROM (VALUES
  (
    'First Steps',
    'Complete your very first course',
    NULL::TEXT,
    '{"type": "completions", "count": 1}'::JSONB,
    'learning'
  ),
  (
    'Dedicated Learner',
    'Complete 5 courses',
    NULL,
    '{"type": "completions", "count": 5}'::JSONB,
    'learning'
  ),
  (
    'Knowledge Seeker',
    'Complete 10 courses',
    NULL,
    '{"type": "completions", "count": 10}'::JSONB,
    'learning'
  ),
  (
    'Quick Starter',
    'Enroll in 3 courses',
    NULL,
    '{"type": "enrollments", "count": 3}'::JSONB,
    'engagement'
  ),
  (
    'Point Collector',
    'Earn 500 points',
    NULL,
    '{"type": "points", "count": 500}'::JSONB,
    'achievement'
  ),
  (
    'Streak Champion',
    'Maintain a 7-day learning streak',
    NULL,
    '{"type": "streak", "count": 7}'::JSONB,
    'engagement'
  )
) AS v(name, description, image_url, criteria, category)
WHERE NOT EXISTS (SELECT 1 FROM badges LIMIT 1);
