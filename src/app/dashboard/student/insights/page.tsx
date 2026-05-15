'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import StudentNav from '../components/StudentNav'
import aiInsightIcon from '../../../public/ai_insight.png'
import streakIcon from '../../../public/streak.png'
import stonksIcon from '../../../public/stonks_rank.png'
import ulasIcon from '../../../public/ulas_kembali.png'
import challengeIcon from '../../../public/challenge.png'

/* ─────────── types ─────────── */
interface MmrPoint { label: string; value: number }
interface SkillPoint { name: string; value: number }
interface HeatDay { day: string; weeks: { date: string; active: boolean; intensity: number }[] }
interface AiRec { title: string; body: string; type: 'review' | 'challenge' | 'info' }
interface InsightsData {
  mmr_trend: MmrPoint[]
  latest_mmr: number
  skill_distribution: SkillPoint[]
  current_streak: number
  longest_streak: number
  heatmap: HeatDay[]
  ai_recommendations: AiRec[]
  total_attempts: number
  total_correct: number
}

/* ─────────── Bar Chart ─────────── */
function MmrBarChart({ data }: { data: MmrPoint[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end justify-between gap-2 h-36 w-full px-1">
      {data.map((pt, i) => {
        const pct = pt.value === 0 ? 0 : Math.max((pt.value / max) * 100, 8)
        const isLast = i === data.length - 1
        return (
          <div key={pt.label} className="flex flex-col items-center gap-1 flex-1 group">
            <div className="relative w-full flex justify-center items-end" style={{ height: '108px' }}>
              {/* Tooltip */}
              <div className="absolute -top-8 bg-[#2C1A08] text-white text-[11px] font-bold py-1 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap shadow-md">
                {pt.value.toLocaleString()} Rank
                {/* Arrow */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-[#2C1A08]"></div>
              </div>

              <div
                className="w-full rounded-t-lg transition-all duration-700 cursor-pointer hover:brightness-110"
                style={{
                  height: `${pct}%`,
                  background: isLast
                    ? 'linear-gradient(180deg,#C8922A,#A67520)'
                    : 'linear-gradient(180deg,#E8C870,#C8A84B)',
                  opacity: pt.value === 0 ? 0.25 : 1,
                }}
              />
            </div>
            <span className="text-[10px] text-[#8B6340] font-sans font-medium">{pt.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────── Radar Chart ─────────── */
function RadarChart({ data }: { data: SkillPoint[] }) {
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const r = 80
  const n = data.length

  if (n < 3) {
    return (
      <div className="flex flex-col items-center justify-center h-[220px] gap-2">
        <span className="text-[12px] text-[#8B6340] font-sans text-center">
          {n === 0 ? 'Belum ada data course.' : 'Minimal 3 course diperlukan.'}
        </span>
      </div>
    )
  }

  const getPoint = (i: number, val: number): [number, number] => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    const dist = (val / 100) * r
    return [cx + dist * Math.cos(angle), cy + dist * Math.sin(angle)]
  }

  const getLabelPoint = (i: number): [number, number] => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    return [cx + (r + 22) * Math.cos(angle), cy + (r + 22) * Math.sin(angle)]
  }

  const dataPath = data.map((d, i) => getPoint(i, d.value)).map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z'

  const gridLevels = [0.25, 0.5, 0.75, 1]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid */}
      {gridLevels.map(lvl => {
        const pts = data.map((_, i) => {
          const [x, y] = getPoint(i, lvl * 100)
          return `${x},${y}`
        }).join(' ')
        return <polygon key={lvl} points={pts} fill="none" stroke="#E8D8C0" strokeWidth="1" />
      })}
      {/* Axes */}
      {data.map((_, i) => {
        const [x, y] = getPoint(i, 100)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E8D8C0" strokeWidth="1" />
      })}
      {/* Data polygon */}
      <path d={dataPath} fill="rgba(200,146,42,0.2)" stroke="#C8922A" strokeWidth="2" />
      {/* Data dots */}
      {data.map((d, i) => {
        const [x, y] = getPoint(i, d.value)
        return <circle key={i} cx={x} cy={y} r={4} fill="#C8922A" stroke="white" strokeWidth="1.5" />
      })}
      {/* Labels */}
      {data.map((d, i) => {
        const [lx, ly] = getLabelPoint(i)
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fill="#5C3D1A" fontFamily="sans-serif" fontWeight="600">
            {d.name.length > 12 ? d.name.slice(0, 10) + '…' : d.name}
          </text>
        )
      })}
    </svg>
  )
}

/* ─────────── Heatmap ─────────── */
function HeatmapGrid({ data, streak }: { data: HeatDay[]; streak: number }) {
  const intensityColor = (intensity: number, active: boolean) => {
    if (!active) return '#F0E8DC'
    if (intensity >= 5) return '#7A5400'
    if (intensity >= 4) return '#9A6D10'
    if (intensity >= 3) return '#C8922A'
    if (intensity >= 2) return '#D9A84B'
    return '#EAC870'
  }

  return (
    <div className="w-full flex gap-3">
      {/* Day labels */}
      <div className="flex flex-col gap-2 justify-center pt-1 shrink-0">
        {data.map(d => (
          <span key={d.day} className="text-[11px] text-[#8B6340] font-sans w-12 leading-none flex items-center h-[32px] sm:h-[40px]">
            {d.day}
          </span>
        ))}
      </div>
      {/* Grid */}
      <div className="flex flex-col gap-2 flex-1">
        {data.map(dayRow => (
          <div key={dayRow.day} className="flex gap-2 w-full h-[32px] sm:h-[40px]">
            {dayRow.weeks.map((cell, wi) => (
              <div
                key={wi}
                title={`${cell.date}${cell.active ? ` · ${cell.intensity} aktivitas` : ''}`}
                className="flex-1 rounded-[6px] transition-transform hover:scale-[1.01] cursor-default"
                style={{ backgroundColor: intensityColor(cell.intensity, cell.active) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────── Skeleton ─────────── */
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#EDE4D3] rounded-xl ${className}`} />
}

/* ─────────── Main Page ─────────── */
export default function InsightsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/user/me')
      .then(r => r.ok ? r.json() : null)
      .then(u => setUser(u))
  }, [])

  useEffect(() => {
    fetch('/api/student/insights')
      .then(async r => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}))
          throw new Error(e.error || 'Gagal memuat insights')
        }
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const recIcon = (type: AiRec['type']) => {
    if (type === 'review') return ulasIcon
    if (type === 'challenge') return challengeIcon
    return aiInsightIcon
  }

  const accuracy = data && data.total_attempts > 0
    ? Math.round((data.total_correct / data.total_attempts) * 100)
    : 0

  return (
    <div className="min-h-screen bg-[#FBF7F0] flex flex-col">
      <StudentNav active="insights" user={user} />

      <main className="flex-1 w-full max-w-[860px] mx-auto px-4 md:px-8 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-[32px] font-bold text-[#2C1A08]">Insight Akademik</h1>
          <p className="font-sans text-[14px] text-[#5C3D1A] mt-1">
            Selamat datang kembali, <span className="font-semibold text-[#C8922A]">{user?.full_name?.split(' ')[0] || 'Pelajar'}</span>. Jelajahi evolusi kognitif Anda dan temukan jalan menuju penguasaan intelektual yang lebih dalam.
          </p>
        </div>

        {error && (
          <div className="bg-[#FDEDEC] border border-[#F5A4A0] rounded-2xl p-4 mb-6 text-[13px] text-[#B32128] font-sans">
            {error}
          </div>
        )}

        {/* Row 1: MMR Trend + Skill Distribution */}
        <div className="grid md:grid-cols-[3fr_2fr] gap-5 mb-5">

          {/* MMR Trend Card */}
          <div className="bg-white rounded-2xl p-6 border border-[#EDE4D3] shadow-[0_2px_16px_rgba(44,26,8,0.06)]">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="font-heading text-[18px] font-bold text-[#2C1A08]">Cognitive MMR Trend</h2>
                <p className="font-sans text-[11px] text-[#8B6340]">Kemajuan intelektual Anda dalam 6 bulan terakhir</p>
              </div>
              {loading ? (
                <Skeleton className="w-24 h-7" />
              ) : (
                <div className="flex items-center gap-1.5 bg-[#FBF3E8] border border-[#E8D0A0] rounded-full px-3 py-1.5">
                  <Image src={stonksIcon} alt="rank" width={14} height={14} />
                  <span className="font-sans text-[12px] font-bold text-[#7A5400]">{data?.latest_mmr.toLocaleString()} Rank</span>
                </div>
              )}
            </div>
            <div className="mt-4">
              {loading ? (
                <div className="flex items-end gap-2 h-36">
                  {[40, 55, 48, 70, 85, 80].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-lg bg-[#EDE4D3] animate-pulse" style={{ height: `${h}%` }} />
                  ))}
                </div>
              ) : (
                <MmrBarChart data={data?.mmr_trend ?? []} />
              )}
            </div>
          </div>

          {/* Skill Distribution Card */}
          <div className="bg-white rounded-2xl p-6 border border-[#EDE4D3] shadow-[0_2px_16px_rgba(44,26,8,0.06)] flex flex-col items-center">
            <h2 className="font-heading text-[18px] font-bold text-[#2C1A08] self-start">Distribusi Keahlian</h2>
            <div className="mt-3 flex-1 flex items-center justify-center">
              {loading ? (
                <Skeleton className="w-[200px] h-[200px] rounded-full" />
              ) : (
                <RadarChart data={data?.skill_distribution ?? []} />
              )}
            </div>
            {!loading && data && data.skill_distribution.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
                {data.skill_distribution.map(s => (
                  <span key={s.name} className="text-[10px] text-[#8B6340] font-sans flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#C8922A] inline-block" />
                    {s.name} {s.value}%
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: AI Recommendations */}
        <div className="bg-white rounded-2xl p-6 border border-[#EDE4D3] shadow-[0_2px_16px_rgba(44,26,8,0.06)] mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#FBF3E8] border border-[#E8D0A0] flex items-center justify-center flex-shrink-0">
              <Image src={aiInsightIcon} alt="AI" width={20} height={20} />
            </div>
            <h2 className="font-heading text-[18px] font-bold text-[#2C1A08]">Saran Pembelajaran AI</h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : data?.ai_recommendations && data.ai_recommendations.length > 0 ? (
            <div className="space-y-3">
              {data.ai_recommendations.map((rec, i) => (
                <div key={i} className="flex gap-4 bg-[#FDFBF7] border border-[#EDE4D3] rounded-xl p-4 hover:border-[#C8922A]/40 transition-colors">
                  <div className="w-8 h-8 flex-shrink-0 mt-0.5">
                    <Image src={recIcon(rec.type)} alt={rec.type} width={32} height={32} />
                  </div>
                  <div>
                    <h3 className="font-sans text-[14px] font-bold text-[#2C1A08] mb-1">{rec.title}</h3>
                    <p className="font-sans text-[13px] text-[#5C3D1A] leading-relaxed">{rec.body}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="font-sans text-[13px] text-[#8B6340]">
                {data?.total_attempts === 0
                  ? 'Mulai kerjakan quest untuk mendapatkan saran pembelajaran AI.'
                  : 'Anda sudah dalam jalur yang baik! Terus kerjakan quest harian.'}
              </p>
            </div>
          )}

          {/* Stats row */}
          {!loading && data && (
            <div className="flex gap-4 mt-4 pt-4 border-t border-[#EDE4D3]">
              <div className="flex-1 text-center">
                <p className="font-heading text-[22px] font-bold text-[#C8922A]">{data.total_attempts}</p>
                <p className="font-sans text-[11px] text-[#8B6340]">Total Quest</p>
              </div>
              <div className="w-px bg-[#EDE4D3]" />
              <div className="flex-1 text-center">
                <p className="font-heading text-[22px] font-bold text-[#C8922A]">{accuracy}%</p>
                <p className="font-sans text-[11px] text-[#8B6340]">Akurasi</p>
              </div>
              <div className="w-px bg-[#EDE4D3]" />
              <div className="flex-1 text-center">
                <p className="font-heading text-[22px] font-bold text-[#C8922A]">{data.skill_distribution.length}</p>
                <p className="font-sans text-[11px] text-[#8B6340]">Course Aktif</p>
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Intensitas Belajar */}
        <div className="bg-white rounded-2xl p-6 border border-[#EDE4D3] shadow-[0_2px_16px_rgba(44,26,8,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-[18px] font-bold text-[#2C1A08]">Intensitas Belajar</h2>
            {!loading && data && (
              <div className="flex items-center gap-2">
                <span className="font-sans text-[12px] text-[#5C3D1A]">
                  Total <span className="font-bold text-[#C8922A]">{data.longest_streak}</span> Hari Beruntun
                </span>
                <Image src={streakIcon} alt="streak" width={20} height={20} />
              </div>
            )}
          </div>

          {/* Current streak badge */}
          {!loading && data && data.current_streak > 0 && (
            <div className="flex items-center gap-2 bg-[#FBF3E8] border border-[#E8D0A0] rounded-xl px-4 py-2.5 mb-4 w-fit">
              <Image src={streakIcon} alt="streak" width={18} height={18} />
              <span className="font-sans text-[13px] font-semibold text-[#7A5400]">
                🔥 Streak aktif: <span className="text-[#C8922A]">{data.current_streak} hari</span> berturut-turut!
              </span>
            </div>
          )}
          {!loading && data && data.current_streak === 0 && (
            <div className="flex items-center gap-2 bg-[#FDEDEC] border border-[#F5A4A0] rounded-xl px-4 py-2.5 mb-4 w-fit">
              <span className="font-sans text-[13px] font-semibold text-[#B32128]">
                Streak terputus — kerjakan quest hari ini untuk memulai lagi!
              </span>
            </div>
          )}

          {loading ? (
            <Skeleton className="h-44 w-full" />
          ) : (
            <HeatmapGrid data={data?.heatmap ?? []} streak={data?.current_streak ?? 0} />
          )}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 justify-end">
            <span className="font-sans text-[10px] text-[#8B6340]">Tidak aktif</span>
            {['#F0E8DC', '#EAC870', '#D9A84B', '#C8922A', '#9A6D10', '#7A5400'].map(c => (
              <div key={c} className="w-4 h-4 rounded-[3px]" style={{ backgroundColor: c }} />
            ))}
            <span className="font-sans text-[10px] text-[#8B6340]">Sangat aktif</span>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full bg-[#2C1A08] mt-12 py-8 px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="font-heading text-[18px] font-bold text-[#C8922A]">AKSARA</span>
          <p className="font-sans text-[11px] text-[#8B6340] mt-1">© 2024 AKSARA Learning. Empowering Indonesian Scholarship.</p>
        </div>
        <div className="flex gap-6">
          <a href="#" className="font-sans text-[12px] text-[#8B6340] hover:text-[#C8922A] transition-colors">Privacy Policy</a>
          <a href="#" className="font-sans text-[12px] text-[#8B6340] hover:text-[#C8922A] transition-colors">Terms</a>
        </div>
      </footer>
    </div>
  )
}
