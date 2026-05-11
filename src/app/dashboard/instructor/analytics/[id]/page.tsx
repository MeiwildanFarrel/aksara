'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface HeatmapNode {
  id: string
  title: string
}

interface HeatmapStudent {
  user_id: string
  email: string
  scores: Record<string, number>
}

interface RiskStudent {
  user_id: string
  email: string
  risk_score: number
  login_count: number
  avg_quest_score: number
  streak_days: number
  alert: boolean
}

export default function AnalyticsDashboard({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { id: sessionId } = params

  const [heatmapNodes, setHeatmapNodes] = useState<HeatmapNode[]>([])
  const [heatmapStudents, setHeatmapStudents] = useState<HeatmapStudent[]>([])
  const [riskStudents, setRiskStudents] = useState<RiskStudent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [draftData, setDraftData] = useState<{message: string, email: string} | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        const [heatmapRes, riskRes] = await Promise.all([
          fetch(`/api/dashboard/heatmap?session_id=${sessionId}`),
          fetch(`/api/dashboard/risk?session_id=${sessionId}`)
        ])

        if (!heatmapRes.ok || !riskRes.ok) throw new Error('Gagal memuat data analitik')

        const heatmap = await heatmapRes.json()
        const risk = await riskRes.json()

        setHeatmapNodes(heatmap.nodes || [])
        setHeatmapStudents(heatmap.students || [])
        setRiskStudents(risk || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [sessionId])

  async function handleGenerateWA(userId: string) {
    try {
      setIsModalOpen(true)
      setIsGenerating(true)
      setDraftData(null)

      const res = await fetch('/api/dashboard/intervention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, session_id: sessionId })
      })

      if (!res.ok) throw new Error('Gagal generate draft')
      
      const data = await res.json()
      setDraftData({ message: data.draft_message, email: data.student_email })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan')
      setIsModalOpen(false)
    } finally {
      setIsGenerating(false)
    }
  }

  function handleCopyMessage() {
    if (draftData?.message) {
      navigator.clipboard.writeText(draftData.message)
      alert('Tersalin ke clipboard!')
    }
  }

  const getHeatmapColor = (score: number) => {
    if (score === 0) return 'bg-sand-light'
    if (score > 0.8) return 'bg-mastery-dikuasai'
    if (score >= 0.4) return 'bg-mastery-aktif'
    return 'bg-mastery-lemah'
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-golden-ink border-t-transparent" />
          <p className="font-sans text-sm text-ink-brown animate-pulse">Memuat analitik...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-warm-white text-ink-dark">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-sand-light bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
          <button onClick={() => router.push('/dashboard/instructor')} className="rounded-xl p-2.5 text-ink-brown hover:bg-lontar-pale hover:text-ink-dark transition-all">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <span className="font-sans text-[10px] font-semibold text-golden-ink uppercase tracking-widest">Analitik</span>
            <h1 className="font-heading text-xl font-bold text-ink-dark leading-tight">Cognitive Dashboard</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-12">
        {error && (
          <div className="rounded-xl bg-mastery-lemah/10 p-4 text-mastery-lemah border border-mastery-lemah/20 font-sans text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* Cognitive Heatmap */}
        <section className="animate-fade-in-up">
          <div className="mb-6">
            <div className="section-header">
              <h2 className="font-heading text-2xl font-bold">Class Heatmap</h2>
              <p className="mt-1.5 font-sans text-sm text-ink-brown">Pemahaman mahasiswa per topik — <span className="text-mastery-dikuasai font-semibold">hijau</span> dikuasai, <span className="text-mastery-aktif font-semibold">emas</span> aktif, <span className="text-mastery-lemah font-semibold">merah</span> lemah</p>
            </div>
          </div>
          
          <div className="glass-card rounded-3xl p-6 overflow-x-auto">
            {heatmapStudents.length === 0 ? (
              <div className="text-center py-12 lontar-pattern rounded-2xl">
                <p className="font-sans text-ink-brown">Belum ada data mahasiswa untuk sesi ini.</p>
              </div>
            ) : (
              <table className="w-full text-left font-sans text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b-2 border-sand-light text-ink-brown">
                    <th className="pb-4 font-semibold sticky left-0 bg-white z-10 px-3 min-w-[200px] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">Mahasiswa</th>
                    {heatmapNodes.map(node => (
                      <th key={node.id} className="px-2 pb-4 font-semibold" title={node.title}>
                        <div className="w-10 truncate text-xs" title={node.title}>{node.title.substring(0, 3)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-light/50">
                  {heatmapStudents.map(student => (
                    <tr key={student.user_id} className="hover:bg-lontar-pale/50 transition-colors">
                      <td className="py-3 sticky left-0 bg-white z-10 px-3 truncate max-w-[200px] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] font-medium text-ink-dark">
                        {student.email}
                      </td>
                      {heatmapNodes.map(node => (
                        <td key={node.id} className="px-2 py-3">
                          <div 
                            className={`h-7 w-9 rounded-lg ${getHeatmapColor(student.scores[node.id])} transition-all border border-black/5 hover:scale-110 cursor-default`} 
                            title={`${node.title}: ${(student.scores[node.id] * 100).toFixed(0)}%`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Risk Assessment */}
        <section className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="mb-6">
            <div className="section-header">
              <h2 className="font-heading text-2xl font-bold">Risk Assessment</h2>
              <p className="mt-1.5 font-sans text-sm text-ink-brown">Identifikasi dini mahasiswa berisiko gagal berdasarkan AI.</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {riskStudents.length === 0 ? (
              <div className="font-sans text-ink-brown col-span-full text-center py-12 glass-card rounded-3xl lontar-pattern">
                Belum ada data risiko.
              </div>
            ) : (
              riskStudents.map((student, idx) => (
                <div 
                  key={student.user_id} 
                  className={`relative flex flex-col rounded-3xl border p-6 transition-all duration-300 shadow-card bg-white hover:shadow-card-hover animate-fade-in-up
                    ${student.alert ? 'border-mastery-lemah/40 hover:border-mastery-lemah/60' : 'border-sand-light hover:border-golden-ink/30'}`}
                  style={{ animationDelay: `${idx * 0.08}s` }}
                >
                  {/* Alert badge */}
                  {student.alert && (
                    <div className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-mastery-lemah text-white shadow-lg animate-pulse font-bold text-xs">
                      !
                    </div>
                  )}
                  
                  <div className="mb-5">
                    <h3 className="font-sans font-bold text-ink-dark truncate text-base">{student.email}</h3>
                    <div className="mt-3 flex items-center justify-between font-sans text-xs font-semibold text-ink-brown">
                      <span>Risk Score</span>
                      <span className={`font-mono font-bold text-sm ${student.alert ? 'text-mastery-lemah' : 'text-mastery-dikuasai'}`}>
                        {(student.risk_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    {/* Risk bar */}
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-sand-light">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${student.alert ? 'bg-gradient-to-r from-mastery-lemah/80 to-mastery-lemah' : 'bg-gradient-to-r from-mastery-dikuasai/80 to-mastery-dikuasai'}`} 
                        style={{ width: `${Math.min(student.risk_score * 100, 100)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mb-6 grid grid-cols-3 gap-2 text-center font-sans text-xs">
                    <div className="rounded-xl border border-sand-light bg-lontar-pale/50 py-3">
                      <div className="font-bold text-ink-dark text-base">{student.login_count}</div>
                      <div className="text-warm-gray mt-0.5 text-[10px] font-semibold uppercase tracking-wide">Attempts</div>
                    </div>
                    <div className="rounded-xl border border-sand-light bg-lontar-pale/50 py-3">
                      <div className="font-bold text-ink-dark text-base">{(student.avg_quest_score * 100).toFixed(0)}%</div>
                      <div className="text-warm-gray mt-0.5 text-[10px] font-semibold uppercase tracking-wide">Avg Score</div>
                    </div>
                    <div className="rounded-xl border border-sand-light bg-lontar-pale/50 py-3">
                      <div className="font-bold text-ink-dark text-base">{student.streak_days}</div>
                      <div className="text-warm-gray mt-0.5 text-[10px] font-semibold uppercase tracking-wide">Days</div>
                    </div>
                  </div>

                  {/* WA Button */}
                  {student.alert && (
                    <button
                      onClick={() => handleGenerateWA(student.user_id)}
                      className="mt-auto w-full rounded-xl bg-gold-tint/30 py-3 font-sans text-sm font-bold text-deep-gold border border-golden-ink/20 transition-all hover:bg-golden-ink hover:text-white hover:border-golden-ink hover:shadow-gold"
                    >
                      💬 Draft Pesan WA
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Intervention Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-dark/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-sand-light bg-white p-8 shadow-float animate-scale-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-tint text-2xl">💬</div>
              <div>
                <h2 className="font-heading text-xl font-bold text-ink-dark">AI Intervention Draft</h2>
                <p className="font-sans text-xs text-golden-ink font-semibold">Powered by Gemini</p>
              </div>
            </div>
            <p className="mt-3 font-sans text-sm text-ink-brown">Untuk: <span className="font-semibold text-ink-dark">{draftData?.email || 'Loading...'}</span></p>
            
            <div className="mt-6 rounded-2xl border border-sand-light bg-lontar-pale/30 p-5 min-h-[120px]">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-golden-ink border-t-transparent" />
                  <p className="font-sans text-sm font-medium text-golden-ink animate-pulse">Gemini menyusun pesan empati...</p>
                </div>
              ) : (
                <p className="font-sans text-sm leading-relaxed text-ink-dark whitespace-pre-wrap">{draftData?.message}</p>
              )}
            </div>
            
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-outline flex-1"
              >
                Tutup
              </button>
              <button
                disabled={isGenerating}
                onClick={handleCopyMessage}
                className="btn-gold flex-1"
              >
                📋 Copy Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
