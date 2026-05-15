ALTER TABLE public.pdf_chunks DROP CONSTRAINT pdf_chunks_session_id_fkey, ADD CONSTRAINT pdf_chunks_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE public.quests DROP CONSTRAINT quests_node_id_fkey, ADD CONSTRAINT quests_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.skill_nodes(id) ON DELETE CASCADE;

ALTER TABLE public.mastery_scores DROP CONSTRAINT mastery_scores_node_id_fkey, ADD CONSTRAINT mastery_scores_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.skill_nodes(id) ON DELETE CASCADE;

ALTER TABLE public.quest_attempts DROP CONSTRAINT quest_attempts_quest_id_fkey, ADD CONSTRAINT quest_attempts_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES public.quests(id) ON DELETE CASCADE;

ALTER TABLE public.quests DROP CONSTRAINT quests_variant_of_fkey, ADD CONSTRAINT quests_variant_of_fkey FOREIGN KEY (variant_of) REFERENCES public.quests(id) ON DELETE CASCADE;
