import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '../../../../../lib/supabase/server'
import { calculateRiskScore } from '../../../../../lib/risk-score'
import type { Database } from '../../../../../types/supabase'

export const runtime = 'nodejs'

type SessionRow = { id: string; title: string; pin: string | null }
type NodeRow = { id: string; title: string; session_id: string | null }
type ScoreRow = { user_id: string | null; node_id: string | null; score: number | null }
type QuestRow = { id: string; node_id: string | null }
type AttemptRow = {
  user_id: string | null
  quest_id: string | null
  is_correct: boolean | null
  attempted_at: string | null
}
type UserRow = {
  id: string
  email: string | null
  role: string | null
  full_name?: string | null
  phone?: string | null
}

type SupabaseLikeError = { message: string }
type LooseUsersTable = {
  update(payload: Record<string, unknown>): {
    eq(column: string, value: string): Promise<{ error: SupabaseLikeError | null }>
  }
  select(columns: string): {
    in(column: string, values: string[]): Promise<{ data: unknown[] | null; error: SupabaseLikeError | null }>
  }
}
type LooseAdminClient = {
  from(table: 'users'): LooseUsersTable
}

function getServiceClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function displayName(user: UserRow) {
  return user.full_name?.trim() || user.email?.split('@')[0] || 'Mahasiswa'
}

function avg(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function avgNullable(values: Array<number | null>) {
  return avg(values.filter((value): value is number => typeof value === 'number'))
}

function usersTable(admin: ReturnType<typeof getServiceClient>) {
  return (admin as unknown as LooseAdminClient).from('users')
}

function metadataPhone(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.phone ?? metadata?.phone_number ?? metadata?.whatsapp ?? metadata?.whatsapp_number
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function resolveStudentPhone(
  admin: ReturnType<typeof getServiceClient>,
  student: UserRow,
) {
  if (student.phone?.trim()) return student.phone.trim()

  const { data } = await admin.auth.admin.getUserById(student.id)
  const authPhone = data.user?.phone?.trim() || metadataPhone(data.user?.user_metadata)

  if (authPhone) {
    await usersTable(admin)
      .update({ phone: authPhone })
      .eq('id', student.id)
  }

  return authPhone || null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: instructor, error: userErr } = await supabase
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

    if (!instructor || instructor.role !== 'instructor') {
      return NextResponse.json(
        { error: 'Hanya instructor yang dapat mengakses dashboard.' },
        { status: 403 },
      )
    }

    const admin = getServiceClient()

    const { data: sessionsData, error: sessionsErr } = await admin
      .from('sessions')
      .select('id, title, pin')
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false })

    if (sessionsErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil courses.', detail: sessionsErr.message },
        { status: 500 },
      )
    }

    const courses = ((sessionsData ?? []) as SessionRow[]).filter((session) => session.id)
    const courseIds = courses.map((course) => course.id)

    if (courseIds.length === 0) {
      return NextResponse.json({ courses: [], students: [], summary: { avg_mastery: 0, at_risk: 0 } })
    }

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
    const nodeToCourse = new Map(nodes.map((node) => [node.id, node.session_id as string]))

    if (nodeIds.length === 0) {
      return NextResponse.json({ courses, students: [], summary: { avg_mastery: 0, at_risk: 0 } })
    }

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

    const { data: questsData, error: questsErr } = await admin
      .from('quests')
      .select('id, node_id')
      .in('node_id', nodeIds)

    if (questsErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil quests.', detail: questsErr.message },
        { status: 500 },
      )
    }

    const quests = ((questsData ?? []) as QuestRow[]).filter((quest) => quest.id)
    const questIds = quests.map((quest) => quest.id)
    const questToCourse = new Map(
      quests
        .filter((quest) => quest.node_id && nodeToCourse.has(quest.node_id))
        .map((quest) => [quest.id, nodeToCourse.get(quest.node_id as string) as string]),
    )

    let attempts: AttemptRow[] = []
    if (questIds.length > 0) {
      const { data: attemptsData, error: attemptsErr } = await admin
        .from('quest_attempts')
        .select('user_id, quest_id, is_correct, attempted_at')
        .in('quest_id', questIds)

      if (attemptsErr) {
        return NextResponse.json(
          { error: 'Gagal mengambil quest attempts.', detail: attemptsErr.message },
          { status: 500 },
        )
      }
      attempts = (attemptsData ?? []) as AttemptRow[]
    }

    const userIds = new Set<string>()
    for (const score of (scoresData ?? []) as ScoreRow[]) {
      if (score.user_id) userIds.add(score.user_id)
    }
    for (const attempt of attempts) {
      if (attempt.user_id) userIds.add(attempt.user_id)
    }

    if (userIds.size === 0) {
      return NextResponse.json({ courses, students: [], summary: { avg_mastery: 0, at_risk: 0 } })
    }

    const { data: usersData, error: usersErr } = await usersTable(admin)
      .select('id, email, role, full_name, phone')
      .in('id', Array.from(userIds))

    if (usersErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil data student.', detail: usersErr.message },
        { status: 500 },
      )
    }

    const studentUsers = ((usersData ?? []) as UserRow[]).filter((row) => row.role === 'student')

    const scoresByStudentCourse = new Map<string, Map<string, number[]>>()
    for (const score of (scoresData ?? []) as ScoreRow[]) {
      if (!score.user_id || !score.node_id) continue
      const courseId = nodeToCourse.get(score.node_id)
      if (!courseId) continue
      const courseMap = scoresByStudentCourse.get(score.user_id) ?? new Map<string, number[]>()
      const values = courseMap.get(courseId) ?? []
      values.push(typeof score.score === 'number' ? score.score : 0)
      courseMap.set(courseId, values)
      scoresByStudentCourse.set(score.user_id, courseMap)
    }

    const attemptsByStudent = new Map<string, AttemptRow[]>()
    const attemptedCoursesByStudent = new Map<string, Set<string>>()
    for (const attempt of attempts) {
      if (!attempt.user_id) continue
      const rows = attemptsByStudent.get(attempt.user_id) ?? []
      rows.push(attempt)
      attemptsByStudent.set(attempt.user_id, rows)

      if (attempt.quest_id) {
        const courseId = questToCourse.get(attempt.quest_id)
        if (courseId) {
          const courseSet = attemptedCoursesByStudent.get(attempt.user_id) ?? new Set<string>()
          courseSet.add(courseId)
          attemptedCoursesByStudent.set(attempt.user_id, courseSet)
        }
      }
    }

    const students = await Promise.all(studentUsers.map(async (student) => {
      const phone = await resolveStudentPhone(admin, student)
      const courseScores: Record<string, number | null> = {}
      const courseMap = scoresByStudentCourse.get(student.id) ?? new Map<string, number[]>()
      const attemptedCourses = attemptedCoursesByStudent.get(student.id) ?? new Set<string>()

      for (const course of courses) {
        const scoreValues = courseMap.get(course.id) ?? []
        courseScores[course.id] = scoreValues.length > 0 || attemptedCourses.has(course.id)
          ? avg(scoreValues)
          : null
      }

      const masteryValues = Object.values(courseScores)
      const avgMastery = avgNullable(masteryValues)
      const studentAttempts = attemptsByStudent.get(student.id) ?? []
      const correct = studentAttempts.filter((attempt) => attempt.is_correct === true).length
      const avgQuestScore = studentAttempts.length > 0 ? correct / studentAttempts.length : avgMastery
      const activeDays = new Set(
        studentAttempts
          .map((attempt) => attempt.attempted_at?.slice(0, 10))
          .filter((value): value is string => Boolean(value)),
      )
      const riskScore = calculateRiskScore({
        loginCount: studentAttempts.length,
        avgQuestScore,
        streakDays: activeDays.size,
      })
      const missedSessions = courses.filter(
        (course) => courseScores[course.id] !== null && !attemptedCourses.has(course.id) && courseScores[course.id] === 0,
      ).length

      return {
        user_id: student.id,
        name: displayName(student),
        email: student.email ?? '',
        phone,
        course_scores: courseScores,
        avg_mastery: avgMastery,
        risk_score: riskScore,
        missed_sessions: missedSessions,
      }
    }))

    students.sort((a, b) => b.risk_score - a.risk_score)

    return NextResponse.json({
      courses,
      students,
      summary: {
        avg_mastery: avg(students.map((student) => student.avg_mastery).filter((value) => value > 0)),
        at_risk: students.filter((student) => student.risk_score >= 0.6 || student.avg_mastery < 0.5).length,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[dashboard/cognitive] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
