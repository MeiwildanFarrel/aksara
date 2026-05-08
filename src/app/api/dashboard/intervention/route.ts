import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '../../../../../lib/supabase/server'
import { calculateRiskScore } from '../../../../../lib/risk-score'
import { generateText } from '../../../../../lib/gemini'
import type { Database } from '../../../../../types/supabase'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const WEAK_THRESHOLD = 0.4

function getServiceClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface RequestBody {
  user_id?: unknown
  session_id?: unknown
}

interface WeakNode {
  title: string
  score: number
}

export async function POST(request: NextRequest) {
  try {
    // 1. Parse body
    const body = (await request.json().catch(() => ({}))) as RequestBody
    const targetUserId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
    const sessionId =
      typeof body.session_id === 'string' ? body.session_id.trim() : ''

    if (!targetUserId || !UUID_RE.test(targetUserId)) {
      return NextResponse.json(
        { error: 'Field "user_id" wajib UUID valid.' },
        { status: 400 },
      )
    }
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return NextResponse.json(
        { error: 'Field "session_id" wajib UUID valid.' },
        { status: 400 },
      )
    }

    // 2. Auth
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Validasi role instructor
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (userErr) {
      return NextResponse.json(
        { error: 'Gagal cek user.', detail: userErr.message },
        { status: 500 },
      )
    }
    if (!userRow || userRow.role !== 'instructor') {
      return NextResponse.json(
        { error: 'Hanya instructor yang dapat mengakses dashboard.' },
        { status: 403 },
      )
    }

    // 4. Validasi sesi milik instructor ini
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, instructor_id')
      .eq('id', sessionId)
      .maybeSingle()
    if (sessionErr) {
      return NextResponse.json(
        { error: 'Gagal cek sesi.', detail: sessionErr.message },
        { status: 500 },
      )
    }
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 })
    }
    if (session.instructor_id !== user.id) {
      return NextResponse.json(
        { error: 'Anda bukan pemilik sesi ini.' },
        { status: 403 },
      )
    }

    const admin = getServiceClient()

    // 5. Ambil data student
    const { data: studentRow, error: studentErr } = await admin
      .from('users')
      .select('id, email, role')
      .eq('id', targetUserId)
      .maybeSingle()
    if (studentErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil student.', detail: studentErr.message },
        { status: 500 },
      )
    }
    if (!studentRow || studentRow.role !== 'student') {
      return NextResponse.json(
        { error: 'Student tidak ditemukan.' },
        { status: 404 },
      )
    }
    const studentEmail = studentRow.email ?? ''

    // 6. Skill nodes dalam sesi
    const { data: nodes, error: nodesErr } = await admin
      .from('skill_nodes')
      .select('id, title')
      .eq('session_id', sessionId)
    if (nodesErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil skill nodes.', detail: nodesErr.message },
        { status: 500 },
      )
    }
    const nodeList = (nodes ?? []).filter(
      (n): n is { id: string; title: string } =>
        typeof n.id === 'string' && typeof n.title === 'string',
    )
    const nodeIds = nodeList.map((n) => n.id)

    // 7. Mastery scores student ini di node-node sesi
    const scoreMap = new Map<string, number>()
    if (nodeIds.length > 0) {
      const { data: scoresData, error: scoresErr } = await admin
        .from('mastery_scores')
        .select('node_id, score')
        .eq('user_id', targetUserId)
        .in('node_id', nodeIds)
      if (scoresErr) {
        return NextResponse.json(
          { error: 'Gagal mengambil mastery_scores.', detail: scoresErr.message },
          { status: 500 },
        )
      }
      for (const s of scoresData ?? []) {
        if (s.node_id) {
          scoreMap.set(s.node_id, typeof s.score === 'number' ? s.score : 0)
        }
      }
    }

    // Hanya pertimbangkan node yang student sudah punya mastery row-nya.
    // Kalau tidak difilter, student baru (tanpa mastery_scores) terlihat lemah
    // di SEMUA topik karena default 0 < WEAK_THRESHOLD.
    const weakNodes: WeakNode[] = nodeList
      .filter((n) => scoreMap.has(n.id))
      .map((n) => ({ title: n.title, score: scoreMap.get(n.id) ?? 0 }))
      .filter((n) => n.score < WEAK_THRESHOLD)
      .sort((a, b) => a.score - b.score)

    // 8. Hitung risk score student
    let questIds: string[] = []
    if (nodeIds.length > 0) {
      const { data: questsData, error: questsErr } = await admin
        .from('quests')
        .select('id')
        .in('node_id', nodeIds)
      if (questsErr) {
        return NextResponse.json(
          { error: 'Gagal mengambil quests.', detail: questsErr.message },
          { status: 500 },
        )
      }
      questIds = (questsData ?? [])
        .map((q) => q.id)
        .filter((id): id is string => typeof id === 'string')
    }

    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
    type AttemptRow = {
      is_correct: boolean | null
      attempted_at: string | null
    }
    let userAttempts: AttemptRow[] = []
    if (questIds.length > 0) {
      const { data: attemptsData, error: attemptsErr } = await admin
        .from('quest_attempts')
        .select('is_correct, attempted_at')
        .eq('user_id', targetUserId)
        .in('quest_id', questIds)
        .gte('attempted_at', sevenDaysAgo)
      if (attemptsErr) {
        return NextResponse.json(
          { error: 'Gagal mengambil quest_attempts.', detail: attemptsErr.message },
          { status: 500 },
        )
      }
      userAttempts = attemptsData ?? []
    }

    const loginCount = userAttempts.length
    const correctCount = userAttempts.filter((a) => a.is_correct === true).length
    const avgQuestScore = loginCount > 0 ? correctCount / loginCount : 0
    const days = new Set<string>()
    for (const a of userAttempts) {
      if (a.attempted_at) days.add(a.attempted_at.slice(0, 10))
    }
    const riskScore = calculateRiskScore({
      loginCount,
      avgQuestScore,
      streakDays: days.size,
    })

    // 9. Susun prompt & panggil Gemini
    const weakList =
      weakNodes.length > 0
        ? weakNodes
            .map((n) => `${n.title} (mastery ${(n.score * 100).toFixed(0)}%)`)
            .join(', ')
        : '(belum ada topik lemah teridentifikasi)'

    const studentName = studentEmail.trim() !== '' ? studentEmail : 'mahasiswa'

    const prompt =
      `Kamu adalah dosen. Buat draft pesan WhatsApp singkat (maks 3 kalimat) ` +
      `dalam Bahasa Indonesia yang personal dan supportif untuk mahasiswa ` +
      `bernama ${studentName} yang memiliki risk score ${riskScore.toFixed(2)} ` +
      `dan kesulitan di topik: ${weakList}. Jangan terlalu formal.`

    let draftMessage: string
    try {
      draftMessage = await generateText(prompt)
    } catch (llmErr) {
      const detail = llmErr instanceof Error ? llmErr.message : 'unknown error'
      console.error('[dashboard/intervention] LLM error:', detail)
      return NextResponse.json(
        { error: 'Gagal menghasilkan draft pesan.', detail },
        { status: 502 },
      )
    }

    return NextResponse.json({
      draft_message: draftMessage,
      student_email: studentEmail,
      weak_nodes: weakNodes,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[dashboard/intervention] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
