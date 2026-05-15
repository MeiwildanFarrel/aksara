-- Add status column to sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- Add timer column to skill_nodes, we'll store as text (e.g., '30 Mins') or int. Let's use int for minutes, or text.
ALTER TABLE public.skill_nodes ADD COLUMN IF NOT EXISTS timer text DEFAULT '30 Mins';