-- Allow 'mentorship' as a notification type so we can send match notifications
-- to mentors and mentees in their in-app inbox.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('enrollment', 'reminder', 'completion', 'certification', 'announcement', 'mention', 'mentorship'));
