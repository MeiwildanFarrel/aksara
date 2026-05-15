import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { generateText } from '../../../../../lib/gemini'

export const runtime = 'nodejs'

function toDateStr(iso: string) {
  return iso.slice(0, 10)
}

function avg(vals: number[]) {
  if (!vals.length) return 0
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

/** Hitung streak & total hari beruntun dari daftar tanggal aktivitas */
function computeStreak(activityDates: string[]): { current: number; longest: number } {
  if (!activityDates.length) return { current: 0, longest: 0 }

  const unique = [...new Set(activityDates)].sort()
  let currentStreak = 1
  let longestStreak = 1
  let tempStreak = 1

  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1])
    const curr = new Date(unique[i])
    const diffMs = curr.getTime() - prev.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      tempStreak++
      longestStreak = Math.max(longestStreak, tempStreak)
    } else if (diffDays > 1) {
      tempStreak = 1
    }
  }

  // Check if streak is still active (last activity was today or yesterday)
  const today = toDateStr(new Date().toISOString())
  const yesterday = toDateStr(new Date(Date.now() - 86400000).toISOString())
  const lastDate = unique[unique.length - 1]

  if (lastDate === today || lastDate === yesterday) {
    // Recalculate current streak from end
    let cs = 1
    for (let i = unique.length - 1; i > 0; i--) {
      const prev = new Date(unique[i - 1])
      const curr = new Date(unique[i])
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000)
      if (diffDays === 1) {
        cs++
      } else {
        break
      }
    }
    currentStreak = cs
  } else {
    currentStreak = 0
  }

  return { current: currentStreak, longest: Math.max(longestStreak, currentStreak) }
}

/** Build 6-month MMR trend from mastery scores history */
function buildMmrTrend(
  attempts: { attempted_at: string | null; is_correct: boolean | null }[],
) {
  const now = new Date()
  const months: { label: string; value: number }[] = []
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const label = monthNames[m]

    const monthAttempts = attempts.filter((a) => {
      if (!a.attempted_at) return false
      const d2 = new Date(a.attempted_at)
      return d2.getFullYear() === y && d2.getMonth() === m
    })

    const correct = monthAttempts.filter((a) => a.is_correct === true).length
    const total = monthAttempts.length
    // MMR base 1000-1500 based on accuracy + volume
    const accuracy = total > 0 ? correct / total : 0
    const volumeBonus = Math.min(total * 8, 300)
    const mmr = total === 0 ? 0 : Math.round(1000 + accuracy * 300 + volumeBonus)

    months.push({ label, value: mmr })
  }

  return months
}

/** Build heatmap data for current week + past weeks */
function buildHeatmap(activityDates: string[]) {
  const dateSet = new Set(activityDates)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build 7 weeks x 7 days grid (most recent week last)
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const result: { day: string; weeks: { date: string; active: boolean; intensity: number }[] }[] = []

  for (let d = 0; d < 7; d++) {
    const weeks: { date: string; active: boolean; intensity: number }[] = []
    for (let w = 6; w >= 0; w--) {
      const date = new Date(today)
      date.setDate(today.getDate() - (w * 7) - (today.getDay() - d + 7) % 7)
      const dateStr = toDateStr(date.toISOString())
      const active = dateSet.has(dateStr)

      // Count multiple activities in the same day for intensity
      const intensity = activityDates.filter((x) => x === dateStr).length
      weeks.push({ date: dateStr, active, intensity: Math.min(intensity, 5) })
    }
    result.push({ day: dayNames[d], weeks })
  }

  return result
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

    // 1. Get enrolled sessions from localStorage (client side) – but we query all student attempts
    // Fetch all mastery scores for this student
    const { data: masteryData } = await supabase
      .from('mastery_scores')
      .select('node_id, score, updated_at')
      .eq('user_id', user.id)

    // 2. Fetch quest attempts (all time for trend, activity dates)
    const { data: attemptsData } = await supabase
      .from('quest_attempts')
      .select('quest_id, is_correct, attempted_at')
      .eq('user_id', user.id)
      .order('attempted_at', { ascending: false })

    const attempts = attemptsData ?? []
    const mastery = masteryData ?? []

    // 3. Get node info for mastery scores
    const nodeIds = [...new Set(mastery.map((m) => m.node_id).filter(Boolean))] as string[]
    let nodes: { id: string; title: string; session_id: string | null }[] = []
    if (nodeIds.length > 0) {
      const { data: nodesData } = await supabase
        .from('skill_nodes')
        .select('id, title, session_id')
        .in('id', nodeIds)
      nodes = nodesData ?? []
    }

    // 4. Get sessions for enrolled courses
    const sessionIds = [...new Set(nodes.map((n) => n.session_id).filter(Boolean))] as string[]
    let sessions: { id: string; title: string }[] = []
    if (sessionIds.length > 0) {
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('id, title')
        .in('id', sessionIds)
      sessions = sessionsData ?? []
    }

    // 5. Build Skill Distribution per session/course
    const skillDistribution: { name: string; value: number }[] = []
    for (const session of sessions) {
      const sessionNodes = nodes.filter((n) => n.session_id === session.id)
      const sessionNodeIds = sessionNodes.map((n) => n.id)
      const sessionMastery = mastery.filter((m) => m.node_id && sessionNodeIds.includes(m.node_id))
      const avgScore = avg(sessionMastery.map((m) => (typeof m.score === 'number' ? m.score : 0)))
      skillDistribution.push({
        name: session.title.length > 20 ? session.title.slice(0, 18) + '…' : session.title,
        value: Math.round(avgScore * 100),
      })
    }

    // 6. MMR Trend (6 months)
    const mmrTrend = buildMmrTrend(
      attempts.map((a) => ({ attempted_at: a.attempted_at, is_correct: a.is_correct })),
    )
    const latestMmr = mmrTrend.filter((m) => m.value > 0).slice(-1)[0]?.value ?? 1000

    // 7. Activity dates for streak & heatmap
    const activityDates = attempts
      .map((a) => (a.attempted_at ? toDateStr(a.attempted_at) : null))
      .filter((d): d is string => d !== null)

    const { current: currentStreak, longest: longestStreak } = computeStreak(activityDates)
    const heatmap = buildHeatmap(activityDates)

    // 8. Find weak nodes for AI recommendation
    const weakNodes = nodes
      .filter((n) => {
        const score = mastery.find((m) => m.node_id === n.id)?.score ?? 0
        return typeof score === 'number' && score < 0.6 && score > 0
      })
      .map((n) => {
        const score = mastery.find((m) => m.node_id === n.id)?.score ?? 0
        const session = sessions.find((s) => s.id === n.session_id)
        return { title: n.title, score: typeof score === 'number' ? score : 0, course: session?.title ?? '' }
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)

    // 9. Quest accuracy stats per node
    const questIds = [...new Set(attempts.map((a) => a.quest_id).filter(Boolean))] as string[]
    let questToNode = new Map<string, string>()
    if (questIds.length > 0) {
      const { data: questsData } = await supabase
        .from('quests')
        .select('id, node_id')
        .in('id', questIds)
      for (const q of questsData ?? []) {
        if (q.id && q.node_id) questToNode.set(q.id, q.node_id)
      }
    }

    // Group attempts by node
    const attemptsByNode = new Map<string, { correct: number; total: number }>()
    for (const attempt of attempts) {
      if (!attempt.quest_id) continue
      const nodeId = questToNode.get(attempt.quest_id)
      if (!nodeId) continue
      const curr = attemptsByNode.get(nodeId) ?? { correct: 0, total: 0 }
      curr.total++
      if (attempt.is_correct) curr.correct++
      attemptsByNode.set(nodeId, curr)
    }

    // 10. Generate AI Recommendations
    let aiRecommendations: { title: string; body: string; type: 'review' | 'challenge' | 'info' }[] = []

    if (weakNodes.length > 0 || currentStreak === 0) {
      const weakList =
        weakNodes.length > 0
          ? weakNodes.map((n) => `${n.title} (${Math.round(n.score * 100)}% mastery)`).join(', ')
          : '(belum ada topik lemah)'

      const streakInfo =
        currentStreak === 0
          ? 'Mahasiswa belum aktif belakangan ini.'
          : `Streak aktif ${currentStreak} hari.`

      const prompt =
        `Kamu adalah sistem AI tutor cerdas untuk platform belajar AKSARA. ` +
        `Mahasiswa ini memiliki topik dengan mastery rendah: ${weakList}. ${streakInfo} ` +
        `Berikan TEPAT 2 saran pembelajaran singkat dalam Bahasa Indonesia. ` +
        `Format JSON array: [{"title":"judul pendek","body":"penjelasan 1-2 kalimat","type":"review|challenge|info"}]. ` +
        `Saran harus spesifik, motivatif, dan actionable.`

      try {
        const raw = await generateText(prompt)
        // Extract JSON from response
        const jsonMatch = raw.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          aiRecommendations = JSON.parse(jsonMatch[0])
        }
      } catch {
        // Fallback recommendations
        aiRecommendations = weakNodes.slice(0, 2).map((n) => ({
          title: `Ulas Kembali: ${n.title}`,
          body: `Mastery Anda di topik ini ${Math.round(n.score * 100)}%. Coba kerjakan lebih banyak soal untuk meningkatkan pemahaman.`,
          type: 'review' as const,
        }))
      }
    } else if (currentStreak > 0 && weakNodes.length === 0) {
      aiRecommendations = [
        {
          title: 'Pertahankan Momentum!',
          body: `Streak ${currentStreak} hari Anda sangat impressive. Terus kerjakan daily quiz untuk memperkuat pemahaman.`,
          type: 'challenge',
        },
      ]
    }

    return NextResponse.json({
      mmr_trend: mmrTrend,
      latest_mmr: latestMmr,
      skill_distribution: skillDistribution,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      heatmap,
      ai_recommendations: aiRecommendations,
      total_attempts: attempts.length,
      total_correct: attempts.filter((a) => a.is_correct).length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[student/insights] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
