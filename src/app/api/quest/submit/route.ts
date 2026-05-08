import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { updateMastery, PRIOR_MASTERY } from '../../../../../lib/bkt'

export const runtime = 'nodejs'

interface RequestBody {
  quest_id?: unknown
  selected_index?: unknown
  session_id?: unknown
}

type NodeStatus = 'dikuasai' | 'aktif' | 'lemah'

function classifyMastery(score: number): NodeStatus {
  if (score > 0.8) return 'dikuasai'
  if (score >= 0.4) return 'aktif'
  return 'lemah'
}

/**
 * Generate corrective feedback by calling our own /api/ael/query route.
 * Returns null on any failure — feedback is best-effort, never fatal to submit.
 */
async function generateCorrectiveFeedback(
  origin: string,
  cookieHeader: string,
  question: string,
  sessionId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${origin}/api/ael/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        query: question,
        session_id: sessionId,
        mode: 'standard',
      }),
    })

    if (!res.ok) {
      console.error(`[quest/submit] AEL feedback failed: HTTP ${res.status}`)
      return null
    }

    const data = (await res.json()) as { answer?: string }
    return typeof data.answer === 'string' ? data.answer : null
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error('[quest/submit] AEL feedback error:', message)
    return null
  }
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
    const questId = typeof body.quest_id === 'string' ? body.quest_id.trim() : ''
    const selectedIndex =
      typeof body.selected_index === 'number' && Number.isInteger(body.selected_index)
        ? body.selected_index
        : null
    const sessionId =
      typeof body.session_id === 'string' ? body.session_id.trim() : ''

    if (!questId || selectedIndex === null || !sessionId) {
      return NextResponse.json(
        {
          error:
            'Field "quest_id" (string), "selected_index" (integer), dan "session_id" (string) wajib diisi.',
        },
        { status: 400 },
      )
    }

    // 3. Fetch quest (correct_index + node_id + question)
    const { data: quest, error: questErr } = await supabase
      .from('quests')
      .select('id, node_id, question, correct_index')
      .eq('id', questId)
      .maybeSingle()

    if (questErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil quest.', detail: questErr.message },
        { status: 500 },
      )
    }
    if (!quest) {
      return NextResponse.json({ error: 'Quest tidak ditemukan.' }, { status: 404 })
    }
    if (!quest.node_id) {
      return NextResponse.json(
        { error: 'Quest tidak terkait dengan skill node mana pun.' },
        { status: 500 },
      )
    }

    const isCorrect = selectedIndex === quest.correct_index

    // 4. Insert attempt log (best-effort)
    const { error: insertErr } = await supabase.from('quest_attempts').insert({
      user_id: user.id,
      quest_id: quest.id,
      is_correct: isCorrect,
    })
    if (insertErr) {
      console.error('[quest/submit] insert attempt failed:', insertErr.message)
      // continue — attempt log is non-blocking
    }

    // 5. Fetch current mastery (default to PRIOR_MASTERY if no row yet)
    const { data: masteryRow, error: masteryErr } = await supabase
      .from('mastery_scores')
      .select('score')
      .eq('user_id', user.id)
      .eq('node_id', quest.node_id)
      .maybeSingle()

    if (masteryErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil mastery_scores.', detail: masteryErr.message },
        { status: 500 },
      )
    }

    const currentScore =
      typeof masteryRow?.score === 'number' ? masteryRow.score : PRIOR_MASTERY

    // 6. BKT update
    const newScore = updateMastery(currentScore, isCorrect)
    const nodeStatus = classifyMastery(newScore)

    // 7. UPSERT mastery
    const { error: upsertErr } = await supabase.from('mastery_scores').upsert(
      {
        user_id: user.id,
        node_id: quest.node_id,
        score: newScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,node_id' },
    )

    if (upsertErr) {
      return NextResponse.json(
        { error: 'Gagal menyimpan mastery_scores.', detail: upsertErr.message },
        { status: 500 },
      )
    }

    // 8. Generate corrective feedback if wrong (non-blocking on failure)
    let feedback: string | null = null
    if (!isCorrect) {
      const cookieHeader = request.headers.get('cookie') ?? ''
      feedback = await generateCorrectiveFeedback(
        request.nextUrl.origin,
        cookieHeader,
        quest.question,
        sessionId,
      )
    }

    console.log(
      `[quest/submit] user=${user.id.slice(0, 8)} quest=${quest.id.slice(0, 8)} ` +
        `correct=${isCorrect} newMastery=${newScore.toFixed(2)}`,
    )

    // 9. Response
    return NextResponse.json({
      is_correct: isCorrect,
      correct_index: quest.correct_index,
      new_mastery_score: newScore,
      node_status: nodeStatus,
      feedback,
      xp_gained: isCorrect ? 100 : 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[quest/submit] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
