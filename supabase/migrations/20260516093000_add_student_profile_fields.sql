ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nim text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS university text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS faculty text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS study_program text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tier text DEFAULT 'Bronze Scholar';
