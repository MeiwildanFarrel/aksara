'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, BookOpen, Check, CircleDot, Lock, Trophy } from 'lucide-react'
import { createClient } from '../../../../../lib/supabase/client'
import StudentNav from '../components/StudentNav'

type SessionRow = {
  id: string
  title: string
  pin: string
  status?: string | null
}

type SkillNode = {
  id: string
  title: string
  prerequisite_ids: string[]
  position_x: number
  position_y: number
  quest_count: number
}

type MasteryRow = {
  node_id: string | null
  score: number | null
}

type NodeStatus = 'mastered' | 'active' | 'review' | 'locked'

const profileCacheKey = 'student_profile_cache'

function statusForNode(node: SkillNode, index: number, nodes: SkillNode[], scores: Record<string, number>): NodeStatus {
  const score = Math.round((scores[node.id] ?? 0) * 100)
  if (score >= 85) return 'mastered'

  const prerequisites = node.prerequisite_ids ?? []
  const prereqMet = prerequisites.length === 0
    ? index === 0 || Math.round((scores[nodes[index - 1]?.id] ?? 0) * 100) >= 50
    : prerequisites.every((id) => Math.round((scores[id] ?? 0) * 100) >= 50)

  if (!prereqMet) return 'locked'
  if (score > 0 && score < 50) return 'review'
  return 'active'
}

function tierFromMmr(mmr: number) {
  if (mmr >= 2800) return 'Platinum Scholar'
  if (mmr >= 2400) return 'Gold Scholar'
  if (mmr >= 1800) return 'Silver Scholar'
  return 'Bronze Scholar'
}

function nextTier(mmr: number) {
  if (mmr < 1800) return { label: 'Silver Scholar', target: 1800 }
  if (mmr < 2400) return { label: 'Gold Scholar', target: 2400 }
  if (mmr < 2800) return { label: 'Platinum Scholar', target: 2800 }
  return { label: 'Max Rank', target: 2900 }
}

function nodePosition(node: SkillNode, index: number, total: number) {
  const hasAiPosition = Math.abs(node.position_x) > 0 || Math.abs(node.position_y) > 0
  if (hasAiPosition) {
    return {
      x: Math.min(86, Math.max(14, node.position_x <= 1 ? node.position_x * 100 : node.position_x)),
      y: Math.min(86, Math.max(14, node.position_y <= 1 ? node.position_y * 100 : node.position_y)),
    }
  }

  if (total <= 1) return { x: 50, y: 50 }
  const center = 50
  const y = 14 + index * (72 / Math.max(1, total - 1))
  const branch = index % 4 === 2 ? -22 : index % 4 === 3 ? 22 : 0
  return { x: center + branch, y }
}

function statusTone(status: NodeStatus) {
  if (status === 'mastered') return 'border-[#5BB47A] text-[#4AA36D] bg-white shadow-[0_0_0_7px_rgba(91,180,122,0.12)]'
  if (status === 'active') return 'border-[#D1992A] text-[#C8922A] bg-white shadow-[0_0_0_7px_rgba(200,146,42,0.12)]'
  if (status === 'review') return 'border-[#C9252D] text-[#C9252D] bg-white'
  return 'border-[#D8CCBC] text-[#8B7B6B] bg-[#F5E9DC]'
}

function statusIcon(status: NodeStatus) {
  if (status === 'mastered') return <Check size={24} strokeWidth={3} />
  if (status === 'active') return <BookOpen size={25} strokeWidth={2.2} />
  if (status === 'review') return <AlertTriangle size={23} strokeWidth={2.3} />
  return <Lock size={22} strokeWidth={2.3} />
}

export default function StudentSkillTreePageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
      </div>
    }>
      <StudentSkillTreePage />
    </Suspense>
  )
}

function StudentSkillTreePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [nodes, setNodes] = useState<SkillNode[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadUserAndSessions() {
      const supabase = createClient()
      const [{ data: auth }, userRes] = await Promise.all([
        supabase.auth.getUser(),
        fetch('/api/user/me', { cache: 'no-store' }),
      ])

      if (!auth.user) {
        router.replace('/login')
        return
      }

      if (userRes.ok) setUser(await userRes.json())

      const saved: SessionRow[] = JSON.parse(localStorage.getItem('student_sessions') || '[]')
      const sessionIds = saved.map((session) => session.id).filter(Boolean)
      if (sessionIds.length === 0) {
        setSessions([])
        setIsLoading(false)
        return
      }

      const { data: activeRows } = await (supabase as any)
        .from('sessions')
        .select('id, title, pin, status')
        .in('id', sessionIds)
        .eq('status', 'Active')

      const activeIds = new Set((activeRows ?? []).map((session: SessionRow) => session.id))
      const merged = saved
        .filter((session) => activeIds.has(session.id))
        .map((session) => ({
          ...session,
          ...(activeRows ?? []).find((row: SessionRow) => row.id === session.id),
          pin: session.pin,
        }))

      setSessions(merged)
      const requestedPin = searchParams.get('pin')
      const requested = requestedPin ? merged.find((session) => session.pin === requestedPin) : null
      setActiveSessionId((requested ?? merged[0])?.id ?? '')
      setIsLoading(false)
    }

    loadUserAndSessions()
  }, [router, searchParams])

  useEffect(() => {
    async function loadSkillTree() {
      if (!activeSessionId) {
        setNodes([])
        setScores({})
        return
      }

      const activeSession = sessions.find((session) => session.id === activeSessionId)
      if (!activeSession) return

      setIsLoading(true)
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      const [nodesRes, masteryRes] = await Promise.all([
        fetch(`/api/session/${activeSession.pin}/nodes`, { cache: 'no-store' }),
        auth.user
          ? supabase.from('mastery_scores').select('node_id, score').eq('user_id', auth.user.id)
          : Promise.resolve({ data: [] as MasteryRow[] }),
      ])

      const fetchedNodes = nodesRes.ok ? (await nodesRes.json()) as SkillNode[] : []
      const masteryRows = (masteryRes.data ?? []) as MasteryRow[]
      const nextScores: Record<string, number> = {}
      masteryRows.forEach((row) => {
        if (row.node_id) nextScores[row.node_id] = row.score ?? 0
      })

      setNodes(fetchedNodes)
      setScores(nextScores)
      setIsLoading(false)
    }

    loadSkillTree()
  }, [activeSessionId, sessions])

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0]
  const decoratedNodes = useMemo(() => {
    return nodes.map((node, index) => ({
      node,
      index,
      status: statusForNode(node, index, nodes, scores),
      position: nodePosition(node, index, nodes.length),
      score: Math.round((scores[node.id] ?? 0) * 100),
    }))
  }, [nodes, scores])

  const averageMastery = nodes.length > 0
    ? Math.round(nodes.reduce((sum, node) => sum + ((scores[node.id] ?? 0) * 100), 0) / nodes.length)
    : 0
  const mmr = Math.round(1500 + (averageMastery / 100) * 1400)
  const tier = tierFromMmr(mmr)
  const next = nextTier(mmr)
  const progressToNext = next.target <= mmr ? 100 : Math.min(100, Math.round((mmr / next.target) * 100))

  useEffect(() => {
    if (!user || !tier) return
    try {
      const cached = JSON.parse(localStorage.getItem(profileCacheKey) || '{}')
      localStorage.setItem(profileCacheKey, JSON.stringify({ ...cached, ...user, tier }))
    } catch {
      // Cache sync is best-effort only.
    }
  }, [user, tier])

  return (
    <div className="min-h-screen bg-[#FBF7F0] text-[#2C1A08]">
      <StudentNav active="skill-tree" user={user ? { ...user, tier } : user} />

      <main className="mx-auto w-full max-w-[1120px] px-4 py-10 md:px-8 md:py-12">
        <section className="mb-10 rounded-[18px] border border-[#E8DCCB] bg-white px-6 py-6 shadow-sm md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#5C5148]">Active Module</p>
              <h1 className="font-heading text-[32px] font-bold leading-tight md:text-[38px]">{activeSession?.title || 'Belum Ada Course'}</h1>
              {sessions.length > 1 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setActiveSessionId(session.id)}
                      className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${session.id === activeSessionId ? 'border-[#C8922A] bg-[#C8922A] text-white' : 'border-[#E8DCCB] bg-[#FAF3EC] text-[#5C3D1A] hover:border-[#C8922A]'}`}
                    >
                      {session.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full max-w-[330px]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-[#5C5148]">Session Mastery</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2C1A08] px-3 py-1 text-xs font-bold text-[#EAB308]">
                  <Trophy size={13} />
                  {tier}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#E8DCCB]">
                <div className="h-full rounded-full bg-[#D29A2B]" style={{ width: `${progressToNext}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-[#5C3D1A]">
                <span>{mmr.toLocaleString('id-ID')} MMR</span>
                <span>{next.label === 'Max Rank' ? 'Max tier reached' : `${next.target.toLocaleString('id-ID')} MMR to ${next.label}`}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#E6D6C4] bg-[#FFF1E8] p-5 md:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-end gap-4 rounded-[14px] border border-[#E8DCCB] bg-white px-5 py-4 shadow-sm">
            <span className="inline-flex items-center gap-2 text-sm text-[#5C5148]"><span className="h-4 w-4 rounded-full bg-[#5BB47A]" /> Mastered</span>
            <span className="inline-flex items-center gap-2 text-sm text-[#5C5148]"><CircleDot size={17} className="text-[#C8922A]" /> Active Target</span>
            <span className="inline-flex items-center gap-2 text-sm text-[#5C5148]"><span className="h-4 w-4 rounded-full bg-[#C9252D]" /> Needs Review</span>
            <span className="inline-flex items-center gap-2 text-sm text-[#5C5148]"><span className="h-4 w-4 rounded-full border border-[#D8CCBC] bg-[#F6E5D4]" /> Locked</span>
          </div>

          <div className="relative min-h-[560px] overflow-hidden rounded-[22px]">
            {isLoading ? (
              <div className="flex min-h-[480px] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
              </div>
            ) : decoratedNodes.length === 0 ? (
              <div className="flex min-h-[480px] flex-col items-center justify-center text-center">
                <BookOpen className="mb-4 text-[#C8922A]" size={36} />
                <h2 className="font-heading text-2xl font-bold">Belum ada skill tree</h2>
                <p className="mt-2 max-w-md text-sm text-[#5C3D1A]">Join course aktif terlebih dahulu, atau tunggu dosen membuat quest dari materi course.</p>
              </div>
            ) : (
              <>
                <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                  {decoratedNodes.map(({ node, position }, index) => {
                    const parents = node.prerequisite_ids.length > 0
                      ? node.prerequisite_ids
                      : index > 0 ? [decoratedNodes[index - 1].node.id] : []
                    return parents.map((parentId) => {
                      const parent = decoratedNodes.find((item) => item.node.id === parentId)
                      if (!parent) return null
                      return (
                        <line
                          key={`${parentId}-${node.id}`}
                          x1={`${parent.position.x}%`}
                          y1={`${parent.position.y}%`}
                          x2={`${position.x}%`}
                          y2={`${position.y}%`}
                          stroke="#D9CBB8"
                          strokeWidth="3"
                          strokeDasharray="6 7"
                          strokeLinecap="round"
                        />
                      )
                    })
                  })}
                </svg>

                {decoratedNodes.map(({ node, status, position, score }) => (
                  <button
                    key={node.id}
                    onClick={() => {
                      if (status !== 'locked' && activeSession) router.push(`/session/${activeSession.pin}/node/${node.id}`)
                    }}
                    className="absolute flex w-[150px] -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                    style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  >
                    <span className={`flex h-[78px] w-[78px] items-center justify-center rounded-full border-[4px] ${statusTone(status)}`}>
                      {statusIcon(status)}
                    </span>
                    <span className={`mt-3 max-w-[150px] rounded-[8px] border bg-white px-3 py-1 text-center text-sm font-bold shadow-sm ${status === 'active' ? 'border-[#C8922A]' : 'border-[#E8DCCB]'}`}>
                      {node.title}
                    </span>
                    <span className="mt-1 text-[11px] font-semibold text-[#8B6340]">
                      {status === 'locked' ? 'Locked' : `${score}% mastery`}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
