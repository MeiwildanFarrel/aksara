-- ============================================================
-- RLS Policies untuk semua tabel
-- ============================================================

-- ─── USERS ───────────────────────────────────────────────────
alter table public.users enable row level security;

-- User hanya bisa baca dan update data dirinya sendiri
drop policy if exists "users: select own" on public.users;
create policy "users: select own"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "users: insert own" on public.users;
create policy "users: insert own"
  on public.users for insert
  with check (auth.uid() = id);

drop policy if exists "users: update own" on public.users;
create policy "users: update own"
  on public.users for update
  using (auth.uid() = id);

-- ─── SESSIONS ────────────────────────────────────────────────
alter table public.sessions enable row level security;

-- Siapa saja (termasuk belum login) bisa SELECT sessions via PIN
-- Diperlukan oleh GET /api/session/[pin] yang bersifat publik
drop policy if exists "sessions: select public" on public.sessions;
create policy "sessions: select public"
  on public.sessions for select
  using (true);

-- Hanya user yang terautentikasi bisa INSERT sesi milik sendiri
drop policy if exists "sessions: insert own" on public.sessions;
create policy "sessions: insert own"
  on public.sessions for insert
  with check (auth.uid() = instructor_id);

-- Hanya instructor pemilik sesi yang bisa UPDATE
drop policy if exists "sessions: update own" on public.sessions;
create policy "sessions: update own"
  on public.sessions for update
  using (auth.uid() = instructor_id);

-- Hanya instructor pemilik sesi yang bisa DELETE
drop policy if exists "sessions: delete own" on public.sessions;
create policy "sessions: delete own"
  on public.sessions for delete
  using (auth.uid() = instructor_id);

-- ─── SKILL_NODES ─────────────────────────────────────────────
alter table public.skill_nodes enable row level security;

-- Baca: siapa saja bisa lihat skill nodes (konten publik per sesi)
drop policy if exists "skill_nodes: select public" on public.skill_nodes;
create policy "skill_nodes: select public"
  on public.skill_nodes for select
  using (true);

-- Tulis: hanya instructor pemilik sesi
drop policy if exists "skill_nodes: insert by instructor" on public.skill_nodes;
create policy "skill_nodes: insert by instructor"
  on public.skill_nodes for insert
  with check (
    auth.uid() = (
      select instructor_id from public.sessions where id = session_id
    )
  );

drop policy if exists "skill_nodes: update by instructor" on public.skill_nodes;
create policy "skill_nodes: update by instructor"
  on public.skill_nodes for update
  using (
    auth.uid() = (
      select instructor_id from public.sessions where id = session_id
    )
  );

drop policy if exists "skill_nodes: delete by instructor" on public.skill_nodes;
create policy "skill_nodes: delete by instructor"
  on public.skill_nodes for delete
  using (
    auth.uid() = (
      select instructor_id from public.sessions where id = session_id
    )
  );

-- ─── MASTERY_SCORES ──────────────────────────────────────────
alter table public.mastery_scores enable row level security;

-- User hanya bisa akses skor miliknya sendiri
drop policy if exists "mastery_scores: select own" on public.mastery_scores;
create policy "mastery_scores: select own"
  on public.mastery_scores for select
  using (auth.uid() = user_id);

drop policy if exists "mastery_scores: insert own" on public.mastery_scores;
create policy "mastery_scores: insert own"
  on public.mastery_scores for insert
  with check (auth.uid() = user_id);

drop policy if exists "mastery_scores: update own" on public.mastery_scores;
create policy "mastery_scores: update own"
  on public.mastery_scores for update
  using (auth.uid() = user_id);

-- ─── QUESTS ──────────────────────────────────────────────────
alter table public.quests enable row level security;

-- Quests bersifat publik (dapat dibaca oleh student dalam sesi)
drop policy if exists "quests: select public" on public.quests;
create policy "quests: select public"
  on public.quests for select
  using (true);

-- Hanya instructor yang bisa insert/update/delete quests
-- (via node → session → instructor chain)
drop policy if exists "quests: insert by instructor" on public.quests;
create policy "quests: insert by instructor"
  on public.quests for insert
  with check (
    auth.uid() = (
      select s.instructor_id
      from public.skill_nodes n
      join public.sessions s on s.id = n.session_id
      where n.id = node_id
    )
  );

drop policy if exists "quests: update by instructor" on public.quests;
create policy "quests: update by instructor"
  on public.quests for update
  using (
    auth.uid() = (
      select s.instructor_id
      from public.skill_nodes n
      join public.sessions s on s.id = n.session_id
      where n.id = node_id
    )
  );

-- ─── QUEST_ATTEMPTS ──────────────────────────────────────────
alter table public.quest_attempts enable row level security;

-- User hanya bisa baca dan insert attempt miliknya sendiri
drop policy if exists "quest_attempts: select own" on public.quest_attempts;
create policy "quest_attempts: select own"
  on public.quest_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "quest_attempts: insert own" on public.quest_attempts;
create policy "quest_attempts: insert own"
  on public.quest_attempts for insert
  with check (auth.uid() = user_id);

-- ─── PDF_CHUNKS ───────────────────────────────────────────────
alter table public.pdf_chunks enable row level security;

-- PDF chunks bisa dibaca siapa saja (untuk RAG query)
drop policy if exists "pdf_chunks: select public" on public.pdf_chunks;
create policy "pdf_chunks: select public"
  on public.pdf_chunks for select
  using (true);

-- Insert hanya oleh instructor pemilik sesi
drop policy if exists "pdf_chunks: insert by instructor" on public.pdf_chunks;
create policy "pdf_chunks: insert by instructor"
  on public.pdf_chunks for insert
  with check (
    auth.uid() = (
      select instructor_id from public.sessions where id = session_id
    )
  );

-- ─── AEL_CACHE ───────────────────────────────────────────────
alter table public.ael_cache enable row level security;

-- Cache bisa dibaca semua user yang terautentikasi
drop policy if exists "ael_cache: select authenticated" on public.ael_cache;
create policy "ael_cache: select authenticated"
  on public.ael_cache for select
  using (auth.role() = 'authenticated');

-- Insert hanya dari server (service role) — tidak dari browser langsung
-- Policy ini sengaja tidak dibuat; gunakan service_role key dari server
