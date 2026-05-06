import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '../../../../../lib/supabase/server'
import {
  checkExactCache,
  checkSemanticCache,
  saveToCache,
} from '../../../../../lib/ael-cache'
import {
  retrieveChunks,
  buildRAGResponse,
  type ExplanationMode,
  type RetrievedChunk,
} from '../../../../../lib/rag'
import { generateEmbedding } from '../../../../../lib/gemini'

export const runtime = 'nodejs'

const VALID_MODES: ExplanationMode[] = ['eli5', 'standard', 'teknikal', 'drill']

interface RequestBody {
  query?: unknown
  session_id?: unknown
  mode?: unknown
}

function hashQuery(query: string): string {
  return createHash('sha256').update(query.trim().toLowerCase()).digest('hex')
}

function chunksToSources(
  chunks: RetrievedChunk[],
): Array<{ source_ref: string; similarity: number }> {
  return chunks.map((c) => ({
    source_ref: c.source_ref,
    similarity: c.similarity,
  }))
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse + validate body
    const body = (await request.json().catch(() => ({}))) as RequestBody
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    const sessionId =
      typeof body.session_id === 'string' ? body.session_id.trim() : ''
    const mode = body.mode as ExplanationMode

    if (!query || !sessionId || !mode) {
      return NextResponse.json(
        { error: 'Field "query", "session_id", dan "mode" wajib diisi.' },
        { status: 400 },
      )
    }

    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json(
        {
          error: `Mode tidak valid. Pilih salah satu: ${VALID_MODES.join(', ')}.`,
        },
        { status: 400 },
      )
    }

    console.log(
      `[ael/query] user=${user.id.slice(0, 8)} session=${sessionId.slice(0, 8)} ` +
        `mode=${mode} query="${query.slice(0, 60)}"`,
    )

    // 3. Tier-1 cache: exact SHA-256 match
    const queryHash = hashQuery(`${query}:${mode}`)
    const exactHit = await checkExactCache(queryHash, mode)
    if (exactHit) {
      return NextResponse.json({
        answer: exactHit,
        sources: [],
        cached: true,
        mode,
      })
    }

    // 4. Generate embedding (needed for both semantic cache + retrieval)
    let queryEmbedding: number[]
    try {
      queryEmbedding = await generateEmbedding(query)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'embedding error'
      console.error('[ael/query] embedding failed:', message)
      return NextResponse.json(
        { error: 'Gagal membuat embedding query.', detail: message },
        { status: 502 },
      )
    }

    // 5. Tier-2 cache: semantic similarity (cosine > 0.92)
    const semanticHit = await checkSemanticCache(queryEmbedding, mode, 0.92)
    if (semanticHit) {
      return NextResponse.json({
        answer: semanticHit,
        sources: [],
        cached: true,
        mode,
      })
    }

    // 6. Cache miss → RAG retrieval
    //    retrieveChunks() embeds the query again internally; that's OK for now.
    const chunks = await retrieveChunks(query, sessionId, 5)

    // 7. Build response (handles empty-chunks fallback inside)
    let answer: string
    try {
      answer = await buildRAGResponse(query, chunks, mode)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LLM error'
      console.error('[ael/query] buildRAGResponse failed:', message)
      return NextResponse.json(
        { error: 'Gagal membuat jawaban.', detail: message },
        { status: 502 },
      )
    }

    // 8. Save to cache (only when we actually retrieved grounding chunks —
    //    don't pollute the cache with the "belum di-cover" fallback).
    if (chunks.length > 0) {
      await saveToCache(queryHash, queryEmbedding, answer, mode)
    } else {
      console.log('[ael/query] skipping cache save (no chunks retrieved)')
    }

    // 9. Return response
    return NextResponse.json({
      answer,
      sources: chunksToSources(chunks),
      cached: false,
      mode,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[ael/query] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
