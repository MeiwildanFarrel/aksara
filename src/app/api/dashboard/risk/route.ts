import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '../../../../../lib/supabase/server'
import { calculateRiskScore } from '../../../../../lib/risk-score'
import type { Database } from '../../../../../types/supabase'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function getServiceClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface RiskRow {
  user_id: string
  email: string
  risk_score: number
  login_count: number
  avg_quest_score: number
  streak_days: number
  alert: boolean
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id')?.trim() ?? ''
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return NextResponse.json(
        { error: 'Query param "session_id" wajib UUID valid.' },
        { status: 400 },
      )
    }

    // 1. Auth
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Validasi role instructor
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

    // 3. Validasi sesi milik instructor ini
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

    // 4. Service-role client
    const admin = getServiceClient()

    // 5. Skill nodes & quests dalam sesi
    const { data: nodes, error: nodesErr } = await admin
      .from('skill_nodes')
      .select('id')
      .eq('session_id', sessionId)
    if (nodesErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil skill nodes.', detail: nodesErr.message },
        { status: 500 },
      )
    }
    const nodeIds = (nodes ?? [])
      .map((n) => n.id)
      .filter((id): id is string => typeof id === 'string')

    if (nodeIds.length === 0) {
      return NextResponse.json([])
    }

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
    const questIds = (questsData ?? [])
      .map((q) => q.id)
      .filter((id): id is string => typeof id === 'string')

    // 6. Quest attempts dalam 7 hari terakhir
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

    type AttemptRow = {
      user_id: string | null
      is_correct: boolean | null
      attempted_at: string | null
    }
    let attempts: AttemptRow[] = []
    if (questIds.length > 0) {
      const { data: attemptsData, error: attemptsErr } = await admin
        .from('quest_attempts')
        .select('user_id, is_correct, attempted_at')
        .in('quest_id', questIds)
        .gte('attempted_at', sevenDaysAgo)
      if (attemptsErr) {
        return NextResponse.json(
          { error: 'Gagal mengambil quest_attempts.', detail: attemptsErr.message },
          { status: 500 },
        )
      }
      attempts = attemptsData ?? []
    }

    // 7. Mastery scores → ikut menentukan student yang terdaftar
    const { data: scoresData, error: scoresErr } = await admin
      .from('mastery_scores')
      .select('user_id')
      .in('node_id', nodeIds)
    if (scoresErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil mastery_scores.', detail: scoresErr.message },
        { status: 500 },
      )
    }

    const userIds = new Set<string>()
    for (const a of attempts) if (a.user_id) userIds.add(a.user_id)
    for (const s of scoresData ?? []) if (s.user_id) userIds.add(s.user_id)

    if (userIds.size === 0) {
      return NextResponse.json([])
    }

    // 8. Ambil profil student
    const { data: usersData, error: usersErr } = await admin
      .from('users')
      .select('id, email, role')
      .in('id', Array.from(userIds))
    if (usersErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil users.', detail: usersErr.message },
        { status: 500 },
      )
    }
    const studentUsers = (usersData ?? []).filter((u) => u.role === 'student')

    // 9. Agregasi per student
    const result: RiskRow[] = studentUsers.map((u) => {
      const userAttempts = attempts.filter((a) => a.user_id === u.id)
      const loginCount = userAttempts.length
      const correctCount = userAttempts.filter((a) => a.is_correct === true).length
      const avgQuestScore = loginCount > 0 ? correctCount / loginCount : 0

      const days = new Set<string>()
      for (const a of userAttempts) {
        if (a.attempted_at) days.add(a.attempted_at.slice(0, 10))
      }
      const streakDays = days.size

      const riskScore = calculateRiskScore({
        loginCount,
        avgQuestScore,
        streakDays,
      })

      return {
        user_id: u.id,
        email: u.email ?? '',
        risk_score: riskScore,
        login_count: loginCount,
        avg_quest_score: avgQuestScore,
        streak_days: streakDays,
        alert: riskScore > 0.6,
      }
    })

    result.sort((a, b) => b.risk_score - a.risk_score)

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[dashboard/risk] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
