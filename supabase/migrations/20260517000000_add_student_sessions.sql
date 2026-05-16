CREATE TABLE public.student_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(student_id, session_id)
);

ALTER TABLE public.student_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student can view own enrollments"
ON public.student_sessions FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "student can enroll self"
ON public.student_sessions FOR INSERT
WITH CHECK (auth.uid() = student_id);
