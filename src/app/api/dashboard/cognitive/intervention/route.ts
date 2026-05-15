import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '../../../../../../lib/supabase/server'
import type { Database } from '../../../../../../types/supabase'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WEAK_THRESHOLD = 0.5

type RequestBody = { user_id?: unknown }
type SessionRow = { id: string; title: string; instructor_id: string | null }
type NodeRow = { id: string; title: string; session_id: string | null }
type ScoreRow = { node_id: string | null; score: number | null }
type UserRow = {
  id: string
  email: string | null
  role: string | null
  full_name?: string | null
  phone?: string | null
}

function getServiceClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function normalizePhone(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  return digits
}

function displayName(user: UserRow) {
  return user.full_name?.trim() || user.email?.split('@')[0] || 'Mahasiswa'
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody
    const targetUserId = typeof body.user_id === 'string' ? body.user_id.trim() : ''

    if (!targetUserId || !UUID_RE.test(targetUserId)) {
      return NextResponse.json(
        { error: 'Field "user_id" wajib UUID valid.' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: instructor, error: instructorErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (instructorErr) {
      return NextResponse.json(
        { error: 'Gagal cek user.', detail: instructorErr.message },
        { status: 500 },
      )
    }

    if (!instructor || instructor.role !== 'instructor') {
      return NextResponse.json(
        { error: 'Hanya instructor yang dapat membuat intervensi.' },
        { status: 403 },
      )
    }

    const admin = getServiceClient()

    const { data: studentData, error: studentErr } = await (admin as any)
      .from('users')
      .select('id, email, role, full_name')
      .eq('id', targetUserId)
      .maybeSingle()

    if (studentErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil student.', detail: studentErr.message },
        { status: 500 },
      )
    }

    const student = studentData as UserRow | null
    if (!student || student.role !== 'student') {
      return NextResponse.json({ error: 'Student tidak ditemukan.' }, { status: 404 })
    }

    const { data: sessionsData, error: sessionsErr } = await admin
      .from('sessions')
      .select('id, title, instructor_id')
      .eq('instructor_id', user.id)

    if (sessionsErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil courses.', detail: sessionsErr.message },
        { status: 500 },
      )
    }

    const courses = ((sessionsData ?? []) as SessionRow[]).filter((session) => session.id)
    const courseIds = courses.map((course) => course.id)

    const { data: nodesData, error: nodesErr } = await admin
      .from('skill_nodes')
      .select('id, title, session_id')
      .in('session_id', courseIds)

    if (nodesErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil skill nodes.', detail: nodesErr.message },
        { status: 500 },
      )
    }

    const nodes = ((nodesData ?? []) as NodeRow[]).filter((node) => node.id && node.session_id)
    const nodeIds = nodes.map((node) => node.id)

    let scores: ScoreRow[] = []
    if (nodeIds.length > 0) {
      const { data: scoresData, error: scoresErr } = await admin
        .from('mastery_scores')
        .select('node_id, score')
        .eq('user_id', targetUserId)
        .in('node_id', nodeIds)

      if (scoresErr) {
        return NextResponse.json(
          { error: 'Gagal mengambil mastery scores.', detail: scoresErr.message },
          { status: 500 },
        )
      }
      scores = (scoresData ?? []) as ScoreRow[]
    }

    const scoreByNode = new Map(
      scores
        .filter((score) => score.node_id)
        .map((score) => [score.node_id as string, typeof score.score === 'number' ? score.score : 0]),
    )

    const weakNodes = nodes
      .filter((node) => scoreByNode.has(node.id))
      .map((node) => {
        const course = courses.find((item) => item.id === node.session_id)
        return {
          title: node.title,
          course_title: course?.title ?? 'Course',
          score: scoreByNode.get(node.id) ?? 0,
        }
      })
      .filter((node) => node.score < WEAK_THRESHOLD)
      .sort((a, b) => a.score - b.score)
      .slice(0, 4)

    const studentName = displayName(student)
    const firstName = studentName.split(' ')[0] || studentName
    const weakText =
      weakNodes.length > 0
        ? weakNodes.map((node) => `${node.title} (${Math.round(node.score * 100)}%)`).join(', ')
        : 'beberapa materi yang belum stabil'

    const message =
      `Halo ${firstName}, saya melihat dari data pembelajaran AKSARA bahwa kamu perlu pendalaman lanjutan pada ${weakText}.\n\n` +
      `Apakah minggu ini ada waktu untuk sesi mentoring singkat? Saya ingin membantu kamu mengejar ketertinggalan materi. Balas pesan ini ya.`

    const normalizedPhone = normalizePhone(student.phone)
    const whatsappUrl = normalizedPhone
      ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
      : null

    return NextResponse.json({
      student: {
        id: student.id,
        name: studentName,
        email: student.email ?? '',
        phone: student.phone ?? null,
        normalized_phone: normalizedPhone || null,
      },
      weak_nodes: weakNodes,
      draft_message: message,
      whatsapp_url: whatsappUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[dashboard/cognitive/intervention] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
