-- Personal documents: a learner's course materials are copied into their
-- Documents tab on enrollment and persist there. Such rows carry user_id (the
-- owner) and course_id (the source course). Organization-wide documents leave
-- both NULL, preserving existing behavior.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_course ON public.documents(user_id, course_id);
