'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Send, X } from 'lucide-react'
import InstructorSidebar from '../components/InstructorSidebar'

import generateBrownIcon from '../../../public/generate_brown.png'
import generateWhiteIcon from '../../../public/generate_white.png'
import sendWaIcon from '../../../public/send_wa.png'

type UserData = {
  id: string
  email: string
  role: string
  full_name?: string
  avatar_url?: string
  university?: string
}

type Course = {
  id: string
  title: string
  pin: string | null
}

type StudentRow = {
  user_id: string
  name: string
  email: string
  phone: string | null
  course_scores: Record<string, number | null>
  avg_mastery: number
  risk_score: number
  missed_sessions: number
}

type CognitiveData = {
  courses: Course[]
  students: StudentRow[]
  summary: {
    avg_mastery: number
    at_risk: number
  }
}

type DraftData = {
  student: {
    id: string
    name: string
    email: string
    phone: string | null
    normalized_phone: string | null
  }
  weak_nodes: Array<{ title: string; course_title: string; score: number }>
  draft_message: string
  whatsapp_url: string | null
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function scoreTone(score: number) {
  if (score >= 0.75) return 'bg-[#78B68D] text-[#173C27]'
  if (score >= 0.5) return 'bg-[#F7CF72] text-[#6A4A00]'
  return 'bg-[#F9D8D6] text-[#9A1D20]'
}

function riskTone(score: number) {
  if (score >= 0.75) return 'bg-[#C9252D]'
  if (score >= 0.5) return 'bg-[#F0C13E]'
  return 'bg-[#78B68D]'
}

export default function CognitiveDashboardPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [data, setData] = useState<CognitiveData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<DraftData | null>(null)
  const [isGenerating, setIsGenerating] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [userRes, cognitiveRes] = await Promise.all([
          fetch('/api/user/me'),
          fetch('/api/dashboard/cognitive'),
        ])

        if (userRes.ok) setUser(await userRes.json())

        if (!cognitiveRes.ok) {
          const payload = await cognitiveRes.json().catch(() => ({}))
          throw new Error(payload.detail || payload.error || 'Gagal memuat cognitive dashboard.')
        }

        setData(await cognitiveRes.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat cognitive dashboard.')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  async function generateIntervention(studentId: string) {
    setIsGenerating(studentId)
    setError('')

    try {
      const response = await fetch('/api/dashboard/cognitive/intervention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: studentId }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.detail || payload.error || 'Gagal membuat draft WA.')
      }

      setDraft(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat draft WA.')
    } finally {
      setIsGenerating(null)
    }
  }

  function sendWhatsApp() {
    if (!draft?.student.normalized_phone) {
      setError('Nomor WhatsApp student belum tersedia. Minta student mengisi Phone Number di Settings Profile.')
      return
    }

    const whatsappUrl = `https://wa.me/${draft.student.normalized_phone}?text=${encodeURIComponent(draft.draft_message)}`
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  }

  const courses = data?.courses ?? []
  const students = data?.students ?? []
  const visibleCourses = courses.slice(0, 5)
  const interventionStudents = useMemo(
    () =>
      students
        .filter((student) => student.risk_score >= 0.45 || student.avg_mastery < 0.65)
        .sort((a, b) => b.risk_score - a.risk_score),
    [students],
  )

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF9F3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
          <p className="font-sans text-sm text-[#5C3D1A] animate-pulse">Memuat cognitive dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#FDF9F3] text-[#2C1A08] font-sans overflow-hidden">
      <InstructorSidebar user={user} active="cognitive" />

      <main className="flex-1 overflow-y-auto custom-scrollbar pt-14 md:pt-0">
        <div className="max-w-7xl mx-auto px-10 py-10">
          <div className="mb-10">
            <h1 className="font-heading text-4xl font-bold text-[#2C1A08] mb-3">Cognitive Dashboard</h1>
            <p className="text-[#5C3D1A] text-lg max-w-3xl">
              Analyze class mastery patterns and identify students requiring intervention across all courses you created.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-[#C0392B]/30 bg-[#FDEDEC] px-5 py-4 text-sm font-semibold text-[#C0392B]">
              {error}
            </div>
          )}

          <section className="bg-white rounded-2xl border border-[#D8CCBC] shadow-sm overflow-hidden mb-12">
            <div className="bg-[#FAF6EF] px-7 py-6 border-b border-[#E9DDD0] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-heading text-2xl font-bold text-[#2C1A08]">Class Mastery Heatmap</h2>
                <p className="text-sm text-[#8B6340] mt-1">
                  Average mastery per student per course, calculated from database mastery scores.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[#5C3D1A]">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#78B68D]" /> Mastered</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#F7CF72]" /> Developing</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#F9D8D6]" /> At Risk</span>
              </div>
            </div>

            <div className="overflow-x-auto p-7">
              {students.length === 0 || visibleCourses.length === 0 ? (
                <div className="py-16 text-center text-[#8B6340]">
                  Belum ada data mastery student untuk course dosen ini.
                </div>
              ) : (
                <table className="w-full min-w-[860px] border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-sm text-[#5C3D1A]">
                      <th className="px-4 py-2 font-semibold">Student</th>
                      {visibleCourses.map((course) => (
                        <th key={course.id} className="px-4 py-2 font-semibold">
                          <span className="line-clamp-1">{course.title}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.user_id} className="text-sm">
                        <td className="px-4 py-2 font-bold text-[#2C1A08] whitespace-nowrap">{student.name}</td>
                        {visibleCourses.map((course) => {
                          const score = student.course_scores[course.id]
                          return (
                            <td key={course.id} className="px-4 py-2">
                              <div className={`rounded-lg px-5 py-3 text-center font-semibold tabular-nums ${typeof score === 'number' ? scoreTone(score) : 'bg-[#F7F2EA] text-[#A89078]'}`}>
                                {typeof score === 'number' ? score.toFixed(2) : '-'}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-2xl font-bold text-[#2C1A08]">Intervention Required</h2>
              <span className="rounded-full bg-[#FCE8E6] px-4 py-1.5 text-sm font-semibold text-[#C0392B]">
                {interventionStudents.length} High Risk Students
              </span>
            </div>

            {interventionStudents.length === 0 ? (
              <div className="rounded-2xl border border-[#E8DCCB] bg-white px-6 py-10 text-center text-[#8B6340]">
                Belum ada student yang memerlukan intervensi berdasarkan data saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {interventionStudents.map((student) => {
                  const riskPercent = Math.round(student.risk_score * 100)
                  return (
                    <article key={student.user_id} className="group bg-white rounded-2xl p-6 border border-[#D8CCBC] shadow-sm hover:shadow-lg transition-all">
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-heading text-sm font-bold ${student.risk_score >= 0.75 ? 'bg-[#F9D8D6] text-[#B32128]' : 'bg-[#FFF2C9] text-[#7B5A05]'}`}>
                          {initials(student.name)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-heading text-xl font-bold text-[#2C1A08] truncate">{student.name}</h3>
                          <p className="text-sm text-[#5C3D1A] truncate">
                            {student.email || 'No email'} {student.phone ? ` - WA: ${student.phone}` : ' - WA belum tersedia'}
                          </p>
                        </div>
                      </div>

                      <div className="mb-6">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-[#5C3D1A]">Risk Score</span>
                          <span className={`font-bold ${student.risk_score >= 0.75 ? 'text-[#C9252D]' : 'text-[#8A6400]'}`}>{riskPercent}%</span>
                        </div>
                        <div className="h-3 rounded-full bg-[#F7E6D4] overflow-hidden">
                          <div className={`h-full rounded-full ${riskTone(student.risk_score)}`} style={{ width: `${riskPercent}%` }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-y border-[#F0E5D5] py-5 mb-6">
                        <div>
                          <p className="text-xs text-[#5C3D1A]">Avg Mastery</p>
                          <p className="font-heading text-2xl font-bold text-[#2C1A08]">{student.avg_mastery.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#5C3D1A]">Missed Sessions</p>
                          <p className="font-heading text-2xl font-bold text-[#2C1A08]">{student.missed_sessions}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => generateIntervention(student.user_id)}
                        disabled={isGenerating === student.user_id}
                        className="w-full border border-[#C8922A] text-[#8A6400] bg-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group-hover:bg-[#C8922A] group-hover:text-white disabled:opacity-60"
                      >
                        <span className="relative w-4 h-4">
                          <Image src={generateBrownIcon} alt="" fill className="object-contain group-hover:opacity-0 transition-opacity" />
                          <Image src={generateWhiteIcon} alt="" fill className="object-contain opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                        {isGenerating === student.user_id ? 'Generating...' : 'Generate WA'}
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {draft && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#2C1A08]/10 backdrop-blur-[1px]">
          <aside className="w-full max-w-[500px] h-full bg-white shadow-2xl flex flex-col">
            <div className="bg-[#FAF6EF] px-8 py-7 border-b border-[#E8DCCB] flex items-center justify-between">
              <h2 className="font-heading text-2xl font-bold text-[#2C1A08]">Intervention Draft</h2>
              <button onClick={() => setDraft(null)} className="text-[#5C3D1A] hover:text-[#C0392B]">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-7">
              <div className="mb-6 text-sm">
                <span className="font-semibold text-[#5C3D1A] mr-2">To:</span>
                <span className="inline-flex rounded-lg bg-[#FDE8D8] px-3 py-2 font-bold text-[#2C1A08]">
                  {draft.student.name} {draft.student.phone ? `(WA: ${draft.student.phone})` : '(WA belum tersedia)'}
                </span>
              </div>

              <div className="mb-6">
                <p className="font-semibold text-[#5C3D1A] mb-2">Identified Weaknesses:</p>
                <div className="flex flex-wrap gap-2">
                  {draft.weak_nodes.length === 0 ? (
                    <span className="rounded-full bg-[#FCE8E6] px-3 py-1 text-xs font-semibold text-[#9A1D20]">No weak node recorded</span>
                  ) : (
                    draft.weak_nodes.map((node) => (
                      <span key={`${node.course_title}-${node.title}`} className="rounded-full bg-[#FCE8E6] px-3 py-1 text-xs font-semibold text-[#9A1D20]">
                        {node.title} ({node.score.toFixed(2)})
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="font-semibold text-[#5C3D1A] mb-3">Message Draft</p>
                <textarea
                  value={draft.draft_message}
                  onChange={(event) => setDraft({ ...draft, draft_message: event.target.value })}
                  className="min-h-[420px] w-full resize-none rounded-2xl border border-[#D8CCBC] bg-[#FFF9F1] p-5 leading-relaxed text-[#2C1A08] focus:outline-none focus:ring-2 focus:ring-[#C8922A]/40"
                />
              </div>
            </div>

            <div className="border-t border-[#E8DCCB] px-8 py-6">
              <button
                onClick={sendWhatsApp}
                className="w-full bg-[#C8922A] text-white font-bold py-3.5 rounded-xl hover:bg-[#A67520] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                disabled={!draft.student.normalized_phone}
              >
                {draft.student.normalized_phone ? (
                  <Image src={sendWaIcon} alt="" width={18} height={18} />
                ) : (
                  <Send size={18} />
                )}
                Send via WhatsApp
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
