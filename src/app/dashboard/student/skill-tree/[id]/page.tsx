'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, BookOpen, Check, CircleDot, Lock, Trophy } from 'lucide-react'
import { createClient } from '../../../../../../lib/supabase/client'
import StudentNav from '../../components/StudentNav'

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Snake grid constants ─────────────────────────────────────────────────────
const NODES_PER_ROW = 3
const NODE_D    = 80    // circle diameter
const H_GAP     = 80    // horizontal gap between node centres
const V_GAP     = 60    // vertical gap between rows (centre to centre of label→circle)
const ROW_H     = NODE_D + V_GAP + 32  // full row height: circle + label + gap
const COL_STEP  = NODE_D + H_GAP       // horizontal step between node centres
const PAD       = 48    // canvas padding

// ─── Topological sort (respects prerequisite chains) ─────────────────────────
function topoSort(nodes: SkillNode[]): SkillNode[] {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const visited = new Set<string>()
  const order: SkillNode[] = []

  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const node = byId.get(id)
    if (!node) return
    for (const pid of (node.prerequisite_ids ?? [])) visit(pid)
    order.push(node)
  }

  nodes.forEach(n => visit(n.id))
  return order
}

// ─── Snake position for index i ───────────────────────────────────────────────
// Row 0 → left-to-right, Row 1 → right-to-left, Row 2 → left-to-right …
function snakePos(i: number): { x: number; y: number } {
  const row = Math.floor(i / NODES_PER_ROW)
  const col = i % NODES_PER_ROW
  const leftToRight = row % 2 === 0
  const colIdx = leftToRight ? col : NODES_PER_ROW - 1 - col
  return {
    x: PAD + colIdx * COL_STEP + NODE_D / 2,
    y: PAD + row * ROW_H + NODE_D / 2,
  }
}

function canvasHeight(count: number): number {
  const rows = Math.ceil(count / NODES_PER_ROW)
  return PAD + rows * ROW_H + 48  // extra bottom pad
}

const CANVAS_W = PAD * 2 + NODES_PER_ROW * COL_STEP - H_GAP

// ─── Status helpers ───────────────────────────────────────────────────────────
function statusForNode(
  node: SkillNode,
  sortedIndex: number,
  sortedNodes: SkillNode[],
  scores: Record<string, number>,
): NodeStatus {
  const score = Math.round((scores[node.id] ?? 0) * 100)
  if (score >= 85) return 'mastered'

  const prerequisites = node.prerequisite_ids ?? []
  const prereqMet =
    prerequisites.length === 0
      ? sortedIndex === 0 || Math.round((scores[sortedNodes[sortedIndex - 1]?.id] ?? 0) * 100) >= 50
      : prerequisites.every(id => Math.round((scores[id] ?? 0) * 100) >= 50)

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

function statusTone(status: NodeStatus) {
  if (status === 'mastered') return 'border-[#5BB47A] bg-white shadow-[0_0_0_6px_rgba(91,180,122,0.15)]'
  if (status === 'active')   return 'border-[#D1992A] bg-white shadow-[0_0_0_8px_rgba(200,146,42,0.2)]'
  if (status === 'review')   return 'border-[#C9252D] bg-white shadow-[0_0_0_5px_rgba(201,37,45,0.08)]'
  return 'border-[#D8CCBC] bg-[#F5E9DC] shadow-[0_0_0_5px_rgba(216,204,188,0.25)]'
}

function statusIcon(status: NodeStatus) {
  if (status === 'mastered') return (
    <div className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#5BB47A] text-white">
      <Check size={20} strokeWidth={3.5} />
    </div>
  )
  if (status === 'active') return (
    <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full border-[1.5px] border-[#C8922A] text-[#C8922A]">
      <BookOpen size={18} strokeWidth={2} />
    </div>
  )
  if (status === 'review') return <AlertTriangle size={24} strokeWidth={2.5} className="text-[#C9252D]" />
  return <Lock size={22} strokeWidth={2.3} className="text-[#8B7B6B]" />
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
export default function StudentSkillTreePageWrapper({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
      </div>
    }>
      <StudentSkillTreePage sessionId={params.id} />
    </Suspense>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
function StudentSkillTreePage({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [user, setUser] = useState<any | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [nodes, setNodes] = useState<SkillNode[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Load user + joined sessions
  useEffect(() => {
    async function loadUserAndSessions() {
      const supabase = createClient()
      const [{ data: auth }, userRes] = await Promise.all([
        supabase.auth.getUser(),
        fetch('/api/user/me', { cache: 'no-store' }),
      ])
      if (!auth.user) { router.replace('/login'); return }
      if (userRes.ok) setUser(await userRes.json())

      const saved: SessionRow[] = JSON.parse(localStorage.getItem('student_sessions') || '[]')
      const sessionIds = saved.map(s => s.id).filter(Boolean)
      if (sessionIds.length === 0) { setSessions([]); setIsLoading(false); return }

      const { data: activeRows } = await (supabase as any)
        .from('sessions')
        .select('id, title, pin, status')
        .in('id', sessionIds)
        .eq('status', 'Active')

      const activeIds = new Set((activeRows ?? []).map((s: SessionRow) => s.id))
      const merged = saved
        .filter(s => activeIds.has(s.id))
        .map(s => ({ ...s, ...(activeRows ?? []).find((r: SessionRow) => r.id === s.id), pin: s.pin }))

      setSessions(merged)
      const requested = merged.find(s => s.id === sessionId)
      setActiveSessionId((requested ?? merged[0])?.id ?? '')
      setIsLoading(false)
    }
    loadUserAndSessions()
  }, [router, sessionId])

  // Load skill tree nodes + mastery
  useEffect(() => {
    async function loadSkillTree() {
      if (!activeSessionId) { setNodes([]); setScores({}); return }
      const activeSession = sessions.find(s => s.id === activeSessionId)
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
      masteryRows.forEach(row => { if (row.node_id) nextScores[row.node_id] = row.score ?? 0 })

      setNodes(fetchedNodes)
      setScores(nextScores)
      setIsLoading(false)
    }
    loadSkillTree()
  }, [activeSessionId, sessions])

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? sessions[0]

  // Sort nodes by prerequisite chain
  const sortedNodes = useMemo(() => topoSort(nodes), [nodes])

  // Compute status for each sorted node
  const decoratedNodes = useMemo(() =>
    sortedNodes.map((node, index) => ({
      node,
      index,
      status: statusForNode(node, index, sortedNodes, scores),
      pos: snakePos(index),
      score: Math.round((scores[node.id] ?? 0) * 100),
    })),
    [sortedNodes, scores],
  )

  // MMR & tier
  const averageMastery = nodes.length > 0
    ? Math.round(nodes.reduce((sum, n) => sum + ((scores[n.id] ?? 0) * 100), 0) / nodes.length)
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
    } catch { /* best-effort */ }
  }, [user, tier])

  const canvasH = canvasHeight(decoratedNodes.length)

  // Build SVG connecting lines between consecutive nodes
  function buildLines() {
    const lines: React.ReactNode[] = []
    for (let i = 1; i < decoratedNodes.length; i++) {
      const prev = decoratedNodes[i - 1]
      const curr = decoratedNodes[i]
      const { pos: p1 } = prev
      const { pos: p2, status } = curr
      const color = status === 'locked' ? '#C4A882' : '#C8922A'
      const dash = '6 4'

      const sameRow = Math.floor((i - 1) / NODES_PER_ROW) === Math.floor(i / NODES_PER_ROW)

      if (sameRow) {
        // Horizontal line between centres
        const x1 = Math.min(p1.x, p2.x) + NODE_D / 2
        const x2 = Math.max(p1.x, p2.x) - NODE_D / 2
        lines.push(
          <line
            key={i}
            x1={x1} y1={p1.y}
            x2={x2} y2={p2.y}
            stroke={color} strokeWidth="2" strokeDasharray={dash}
          />
        )
      } else {
        // Row transition: arc from bottom of prev node → top of next node
        const row = Math.floor((i - 1) / NODES_PER_ROW)
        const leftToRight = row % 2 === 0
        // prev is at the end of its row (right for LTR, left for RTL)
        // next is at start of next row (left for LTR, right for RTL) but positioned opposite
        const x1 = p1.x
        const y1 = p1.y + NODE_D / 2
        const x2 = p2.x
        const y2 = p2.y - NODE_D / 2
        const midY = (y1 + y2) / 2
        lines.push(
          <path
            key={i}
            d={`M ${x1},${y1} C ${x1},${midY} ${x2},${midY} ${x2},${y2}`}
            stroke={color} strokeWidth="2" strokeDasharray={dash} fill="none"
            strokeLinecap="round"
          />
        )
      }
    }
    return lines
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0] text-[#2C1A08]">
      <StudentNav active="skill-tree" user={user ? { ...user, tier } : user} />

      <main className="mx-auto w-full max-w-[1120px] px-4 py-10 md:px-8 md:py-12">

        {/* Header card */}
        <section className="mb-10 rounded-[18px] border border-[#E8DCCB] bg-white px-6 py-6 shadow-sm md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#5C5148]">Active Module</p>
              <h1 className="font-heading text-[32px] font-bold leading-tight md:text-[38px]">
                {activeSession?.title || 'Belum Ada Course'}
              </h1>
              {sessions.length > 1 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                        s.id === activeSessionId
                          ? 'border-[#C8922A] bg-[#C8922A] text-white'
                          : 'border-[#E8DCCB] bg-[#FAF3EC] text-[#5C3D1A] hover:border-[#C8922A]'
                      }`}
                    >
                      {s.title}
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

        {/* Skill tree canvas */}
        <section className="rounded-[28px] border border-[#E6D6C4] bg-[#FFF1E8] p-5 md:p-8">

          {/* Legend */}
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-[#E8DCCB] bg-white px-5 py-3 shadow-sm">
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#5C5148]"><span className="h-3 w-3 rounded-full bg-[#5BB47A]" /> Mastered</span>
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#5C5148]"><CircleDot size={13} strokeWidth={3} className="text-[#C8922A]" /> Active</span>
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#5C5148]"><span className="h-3 w-3 rounded-full bg-[#C9252D]" /> Review</span>
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#5C5148]"><span className="h-3 w-3 rounded-full border border-[#D8CCBC] bg-[#F6E5D4]" /> Locked</span>
          </div>

          {isLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
            </div>
          ) : decoratedNodes.length === 0 ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
              <BookOpen className="mb-4 text-[#C8922A]" size={36} />
              <h2 className="font-heading text-2xl font-bold">Belum ada skill tree</h2>
              <p className="mt-2 max-w-md text-sm text-[#5C3D1A]">
                Tunggu dosen membuat quest dari materi course, atau join course aktif terlebih dahulu.
              </p>
            </div>
          ) : (
            /* Snake grid canvas */
            <div className="overflow-x-auto overflow-y-visible">
              <div
                className="relative mx-auto"
                style={{ width: CANVAS_W, height: canvasH }}
              >
                {/* SVG lines */}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  width={CANVAS_W}
                  height={canvasH}
                  aria-hidden="true"
                >
                  {buildLines()}
                </svg>

                {/* Nodes */}
                {decoratedNodes.map(({ node, status, pos, score }) => {
                  const isLocked   = status === 'locked'
                  const isMastered = status === 'mastered'
                  const isActive   = status === 'active'
                  const isReview   = status === 'review'

                  return (
                    <button
                      key={node.id}
                      disabled={isLocked}
                      onClick={() => {
                        if (!isLocked && activeSession)
                          router.push(`/session/${activeSession.pin}/node/${node.id}/learn`)
                      }}
                      className={`absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 transition-transform group ${
                        isLocked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:scale-[1.06]'
                      }`}
                      style={{ left: pos.x, top: pos.y }}
                    >
                      {/* Circle */}
                      <span
                        className={`flex items-center justify-center rounded-full border-[4px] transition-all`}
                        style={{
                          width: NODE_D,
                          height: NODE_D,
                          ...(statusTone(status).includes('shadow')
                            ? {}
                            : {}),
                        }}
                      >
                        {/* Inner coloured ring via className */}
                        <span
                          className={`flex items-center justify-center rounded-full border-[4px] w-full h-full ${statusTone(status)}`}
                        >
                          {statusIcon(status)}
                        </span>
                      </span>

                      {/* Label */}
                      <span
                        className={`mt-2 w-[110px] rounded-[10px] border px-2 py-1 text-center text-[11px] leading-tight font-bold transition-all ${
                          isReview ? 'bg-[#FFF8F8] border-[#F5A4A0]'
                          : isActive ? 'bg-white border-[#C8922A] shadow-md'
                          : 'bg-white border-[#E8DCCB] shadow-sm'
                        } ${isLocked ? 'text-[#8B7B6B]' : 'text-[#2C1A08]'}`}
                      >
                        {node.title}
                      </span>

                      {/* Score badge */}
                      {score > 0 && (
                        <span className={`mt-1 text-[10px] font-bold ${isMastered ? 'text-[#5BB47A]' : 'text-[#C8922A]'}`}>
                          {score}%
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
