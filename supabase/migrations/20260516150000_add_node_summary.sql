-- Add summary, key_points, flash_cards columns to skill_nodes for flash card feature
ALTER TABLE public.skill_nodes
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS key_points jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS flash_cards jsonb DEFAULT '[]';
