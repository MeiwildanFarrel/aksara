import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '../../../../../lib/supabase/server'
import type { Database } from '../../../../../types/supabase'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getServiceClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface StudentRow {
  user_id: string
  email: string
  scores: Record<string, number>
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

    // 4. Service-role client untuk membaca data lintas-student
    const admin = getServiceClient()

    // 5. Skill nodes dalam sesi
    const { data: nodes, error: nodesErr } = await admin
      .from('skill_nodes')
      .select('id, title')
      .eq('session_id', sessionId)
      .order('title', { ascending: true })
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

    if (nodeIds.length === 0) {
      return NextResponse.json({ nodes: [], students: [] })
    }

    // 6. Mastery scores untuk semua node sesi ini
    const { data: scoresData, error: scoresErr } = await admin
      .from('mastery_scores')
      .select('user_id, node_id, score')
      .in('node_id', nodeIds)
    if (scoresErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil mastery scores.', detail: scoresErr.message },
        { status: 500 },
      )
    }

    // 7. Quest attempts → ikut menentukan siapa saja yang berpartisipasi
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

    const userIds = new Set<string>()
    for (const s of scoresData ?? []) {
      if (s.user_id) userIds.add(s.user_id)
    }
    if (questIds.length > 0) {
      const { data: attemptsData, error: attemptsErr } = await admin
        .from('quest_attempts')
        .select('user_id')
        .in('quest_id', questIds)
      if (attemptsErr) {
        return NextResponse.json(
          { error: 'Gagal mengambil quest_attempts.', detail: attemptsErr.message },
          { status: 500 },
        )
      }
      for (const a of attemptsData ?? []) {
        if (a.user_id) userIds.add(a.user_id)
      }
    }

    if (userIds.size === 0) {
      return NextResponse.json({ nodes: nodeList, students: [] })
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

    // 9. Build map: userId → (nodeId → score)
    const scoreMap = new Map<string, Map<string, number>>()
    for (const s of scoresData ?? []) {
      if (!s.user_id || !s.node_id) continue
      const inner = scoreMap.get(s.user_id) ?? new Map<string, number>()
      inner.set(s.node_id, typeof s.score === 'number' ? s.score : 0)
      scoreMap.set(s.user_id, inner)
    }

    const students: StudentRow[] = studentUsers.map((u) => {
      const inner = scoreMap.get(u.id)
      const scores: Record<string, number> = {}
      for (const nid of nodeIds) {
        scores[nid] = inner?.get(nid) ?? 0
      }
      return {
        user_id: u.id,
        email: u.email ?? '',
        scores,
      }
    })

    return NextResponse.json({ nodes: nodeList, students })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[dashboard/heatmap] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
