# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AKSARA is a web-based AI Learning Copilot for Indonesian higher education, built for the TechSprint Innovation Cup 2026. It combines RAG-grounded tutoring, gamified skill trees, and an instructor cognitive dashboard.

**Deadline**: MVP demo by 17 Mei 2026. Final presentation 30 Mei 2026.

**Team roles**: Farrel (Backend), Axan/Maharaja (Frontend).

## Tech Stack

- **Framework**: Next.js 14 App Router (frontend + API routes)
- **Database**: Supabase (PostgreSQL + pgvector + pgmq + pg_cron)
- **Auth**: Supabase Auth with Google SSO
- **Primary LLM**: Google Gemini 2.5 Flash (`gemini-2.5-flash`)
- **Fallback LLM**: Groq Llama 3.3 70B
- **Embeddings**: Gemini `embedding-001` (768-dimensional)
- **Deployment**: Vercel Hobby (Fluid Compute, 60s function timeout)

## Commands

```bash
npm run dev       # Start development server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
npm run typecheck # TypeScript check (tsc --noEmit)
```

Supabase local dev:
```bash
npx supabase start        # Start local Supabase stack
npx supabase db push      # Apply migrations
npx supabase gen types typescript --local > types/supabase.ts
```

## Architecture

### Core Features

**1. Skill Tree & Mastery Vector**
- Syllabus nodes as a knowledge graph; each node has a mastery score `0.0–1.0`
- Scores update in real-time via Bayesian Knowledge Tracing when quests are answered
- Node states: `dikuasai` (>0.8), `aktif` (0.4–0.8), `lemah` (<0.4), `terkunci` (locked by prerequisites)

**2. Adaptive Explanation Layer (AEL) — RAG pipeline**
- PDFs chunked at 500 chars with 50-char overlap → embedded via Gemini → stored in pgvector
- At query time: embed question → cosine similarity search → top-k chunks → LLM prompt with citations
- 2-tier cache: SHA-256 exact match + semantic cache (cosine similarity > 0.92)
- 4 explanation modes: `eli5` / `standard` / `teknikal` / `drill` (Socratic)
- Every response includes source citations: "Modul 3, hal. 42 — similarity 91%"

**3. Cognitive Dashboard (Instructor)**
- Class heatmap: rows = students, cols = topics, cell color = mastery score
- Risk score per student: `f(login_frequency, quest_score, streak_consistency)`
- Auto-generates WhatsApp draft messages for at-risk students
- 3 remedial quest recommendations per flagged student

### Data Flow

```
Student submits quest answer
  → Mastery vector updated (real-time via Supabase Realtime)
  → On failure: RAG query → AEL feedback response (SSE stream)
  → 3-Strike Lifeline tracks consecutive failures
  → Instructor dashboard alert fires
  → Auto-generate intervention message
```

### Background Processing

- PDF uploads enqueued via `pgmq`, processed by `pg_cron` every 30 seconds
- Chunking → embedding → pgvector upsert happens asynchronously
- MMR (mastery) history snapshots also written via the queue

### API Routes Structure (planned)

```
/api/auth/           Supabase auth callbacks
/api/ael/query       RAG query → streamed LLM response (SSE)
/api/quest/submit    Submit answer, update mastery vector
/api/upload/pdf      Enqueue PDF for background processing
/api/dashboard/      Instructor analytics endpoints
```

### LLM Fallback Logic

Call Gemini first; if rate-limited (429) or error, fall back to Groq. Both share the same prompt template. Log which provider served each request.

### Supabase Schema (key tables)

- `users` — linked to Supabase Auth
- `skill_nodes` — topic graph nodes per course
- `mastery_scores` — `(user_id, node_id, score, updated_at)`
- `quests` — questions linked to skill nodes
- `quest_attempts` — per-attempt log for BKT input
- `pdf_chunks` — `(content, embedding vector(768), source_ref, course_id)`
- `ael_cache` — `(query_hash, query_embedding, response, created_at)`
- `message_queue` (pgmq) — async PDF processing jobs

## Key Constraints

- All LLM calls must stay within free-tier limits: Gemini 1,000 req/day, Groq 1,000 req/day
- Vercel Hobby enforces 60s max function runtime — use SSE streaming for long LLM responses, not waiting
- AEL responses must cite source chunks; never return an answer without a grounding passage
- Mastery scores must be recalculated using BKT parameters `(P_L0, P_T, P_G, P_S)` per node, not simple averages
