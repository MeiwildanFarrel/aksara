'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'
import { createClient } from '../../../../../../lib/supabase/client'

interface Quest {
  id: string
  question: string
  options: string[]
  bloom_level: string
  node_id: string
}

interface SubmitResponse {
  is_correct: boolean
  correct_index: number
  new_mastery_score: number
  node_status: string
  feedback: string | null
  xp_gained: number
}

interface NodeData {
  title: string
  timer?: string
}

export default function QuestPage({ params }: { params: { pin: string, nodeId: string } }) {
  const router = useRouter()
  const { pin, nodeId } = params

  const [quests, setQuests] = useState<Quest[]>([])
  const [nodeData, setNodeData] = useState<NodeData | null>(null)
  const [sessionTitle, setSessionTitle] = useState('Session')
  const [sessionId, setSessionId] = useState('')
  
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Store answers: { [questIndex]: { selectedIndex, result, aelMode, aiInsight } }
  const [answers, setAnswers] = useState<Record<number, { 
    selectedIndex: number, 
    result: SubmitResponse,
    aelMode: string,
    aiInsight: string | null
  }>>({})
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 minutes default
  const [isTimeUp, setIsTimeUp] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient()
        
        const sessionRes = await fetch(`/api/session/${pin}`)
        if (sessionRes.ok) {
          const sData = await sessionRes.json()
          setSessionTitle(sData.title)
          setSessionId(sData.id)
        }

        const [questRes, nodeRes] = await Promise.all([
          fetch(`/api/quest/${nodeId}`),
          supabase.from('skill_nodes').select('title, timer').eq('id', nodeId).single()
        ])

        if (!questRes.ok) throw new Error('Gagal memuat quest')
        
        const data = await questRes.json()
        setQuests(data)
        
        if (nodeRes.data) {
          setNodeData(nodeRes.data)
          if (nodeRes.data.timer) {
            const match = nodeRes.data.timer.match(/(\d+)/)
            if (match) {
              setTimeLeft(parseInt(match[1], 10) * 60)
            }
          }
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [nodeId, pin])

  useEffect(() => {
    if (isLoading || quests.length === 0 || isTimeUp) return;
    
    if (timeLeft <= 0) {
      setIsTimeUp(true)
      return;
    }
    
    const t = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearInterval(t)
  }, [timeLeft, isLoading, quests.length, isTimeUp])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  async function handleOptionClick(idx: number) {
    if (answers[currentIndex] || isSubmitting || isTimeUp) return

    // Optimistic UI: tampilkan pilihan langsung + disable tombol sebelum response
    setPendingSelection(idx)
    setIsSubmitting(true)
    setError(null)

    const currentQuest = quests[currentIndex]
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000)

    try {
      const res = await fetch('/api/quest/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quest_id: currentQuest.id,
          selected_index: idx,
          session_id: sessionId
        }),
        signal: controller.signal
      })

      if (!res.ok) throw new Error('Gagal mengirim jawaban')

      const data: SubmitResponse = await res.json()

      setAnswers(prev => ({
        ...prev,
        [currentIndex]: {
          selectedIndex: idx,
          result: data,
          aelMode: 'standard',
          aiInsight: data.feedback
        }
      }))
      setPendingSelection(null)
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError'
      setError(isTimeout ? 'Koneksi lambat, coba lagi.' : (err instanceof Error ? err.message : 'Terjadi kesalahan'))
      setPendingSelection(null)
    } finally {
      window.clearTimeout(timeoutId)
      setIsSubmitting(false)
    }
  }

  async function handleAelQuery(mode: string) {
    const currentAns = answers[currentIndex]
    if (!currentAns) return

    // Optimistic update mode
    setAnswers(prev => ({
      ...prev,
      [currentIndex]: { ...prev[currentIndex], aelMode: mode, aiInsight: null }
    }))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    try {
      const res = await fetch('/api/ael/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: quests[currentIndex].question,
          session_id: sessionId,
          mode
        }),
        signal: controller.signal
      })

      if (res.ok) {
        const data = await res.json()
        setAnswers(prev => ({
          ...prev,
          [currentIndex]: { ...prev[currentIndex], aiInsight: data.answer }
        }))
      } else {
        throw new Error('AEL error')
      }
    } catch {
      setAnswers(prev => ({
        ...prev,
        [currentIndex]: { ...prev[currentIndex], aiInsight: "Maaf, insight sedang tidak tersedia. Coba lanjut ke soal berikutnya." }
      }))
    } finally {
      clearTimeout(timeout)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
      </div>
    )
  }

  if (quests.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold text-[#2C1A08]">Belum ada Quest</h2>
          <button onClick={() => router.push(`/session/${pin}`)} className="mt-6 font-sans font-semibold text-[#C8922A] hover:text-[#A67520]">
            ← Kembali
          </button>
        </div>
      </div>
    )
  }

  if (isTimeUp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] p-6">
        <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-[#EDE4D3] max-w-md w-full">
          <div className="w-20 h-20 bg-[#FFE8D6] text-[#D35400] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-heading text-2xl font-bold text-[#2C1A08] mb-2">Waktu Habis!</h2>
          <p className="font-sans text-[#8B6340] mb-8">Waktu pengerjaan quiz telah berakhir.</p>
          <button onClick={() => router.push(`/session/${pin}`)} className="bg-[#C8922A] text-white px-8 py-3 rounded-xl w-full font-bold">
            Kembali ke Detail Sesi
          </button>
        </div>
      </div>
    )
  }

  const currentQuest = quests[currentIndex]
  const currentAnswer = answers[currentIndex]

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C1A08] font-sans pb-10">
      {/* Top Navigation */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 font-sans text-[13px] font-semibold text-[#8B6340]">
            <button onClick={() => router.push(`/session/${pin}`)} className="mr-1 hover:text-[#C8922A] transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <span className="truncate max-w-[150px] sm:max-w-xs">{sessionTitle}</span>
            <span className="text-[#EDE4D3] mx-1">&gt;</span>
            <span className="text-[#C8922A]">Quiz No {nodeData?.title ? nodeData.title.replace(/\D/g, '') || (currentIndex + 1) : currentIndex + 1}</span>
          </div>
          <div className="flex items-center gap-2 font-sans font-bold text-[#2C1A08] bg-white border border-[#EDE4D3] px-3 py-1.5 rounded-full shadow-sm">
            <svg className="w-4 h-4 text-[#8B6340]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-2 flex justify-between font-sans text-[12px] font-bold text-[#8B6340]">
          <span>Pertanyaan {currentIndex + 1} dari {quests.length}</span>
          <span>{Math.round(((currentIndex + 1) / quests.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-[#F5EFE4] rounded-full overflow-hidden mb-10">
           <div 
             className="h-full bg-[#E5D0A1] transition-all duration-500 ease-out" 
             style={{ width: `${((currentIndex + 1) / quests.length) * 100}%` }} 
           />
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-[0_8px_30px_rgba(44,26,8,0.04)] border border-[#F0EBE1] relative">
          
          <h2 className="font-heading text-[26px] md:text-[32px] font-bold text-[#2C1A08] leading-snug text-center max-w-2xl mx-auto mb-12">
            {currentQuest.question}
          </h2>

          <div className="grid md:grid-cols-2 gap-4 mb-10">
            {currentQuest.options.map((option, idx) => {
              const letter = String.fromCharCode(65 + idx)
              const isSelected = currentAnswer?.selectedIndex === idx
              const isCorrectOpt = currentAnswer?.result.correct_index === idx
              const isPending = pendingSelection === idx && !currentAnswer

              let wrapperClass = "flex items-center rounded-2xl border-2 p-4 transition-all duration-300 text-left w-full "
              let letterClass = "rounded-full w-8 h-8 shrink-0 flex items-center justify-center font-bold text-sm mr-4 transition-colors "

              if (!currentAnswer && isPending) {
                // Optimistic pending state — highlight selected option immediately
                wrapperClass += "border-[#C8922A] bg-[#FFF7E5] cursor-wait "
                letterClass += "bg-[#C8922A] text-white"
              } else if (!currentAnswer && pendingSelection !== null) {
                // Another option pending — dim other options
                wrapperClass += "border-[#F0EBE1] opacity-50 cursor-not-allowed "
                letterClass += "bg-[#FDFBF7] text-[#D9CDB8]"
              } else if (!currentAnswer) {
                // Not answered, no pending
                wrapperClass += "border-[#F0EBE1] hover:border-[#D9CDB8] hover:bg-[#FDFBF7] cursor-pointer"
                letterClass += "bg-[#FDFBF7] text-[#D9CDB8]"
              } else {
                // Answered state
                wrapperClass += "cursor-default "
                if (isCorrectOpt) {
                  wrapperClass += "border-[#77B28C] bg-[#F4F9F6] "
                  letterClass += "bg-[#77B28C] text-white"
                } else if (isSelected && !isCorrectOpt) {
                  wrapperClass += "border-[#D67B7B] bg-[#FCF5F5] "
                  letterClass += "bg-[#D67B7B] text-white"
                } else {
                  wrapperClass += "border-[#F0EBE1] opacity-60 "
                  letterClass += "bg-[#FDFBF7] text-[#D9CDB8]"
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(idx)}
                  disabled={!!currentAnswer || isSubmitting || isTimeUp}
                  className={wrapperClass}
                >
                  <div className={letterClass}>
                    {isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : currentAnswer && isCorrectOpt ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    ) : currentAnswer && isSelected && !isCorrectOpt ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                    ) : (
                      letter
                    )}
                  </div>
                  <span className={`font-sans text-[15px] font-medium leading-relaxed ${(isPending || (currentAnswer && (isCorrectOpt || isSelected))) ? 'text-[#2C1A08]' : 'text-[#5C3D1A]'}`}>
                    {option}
                  </span>
                  {isPending && (
                    <div className="ml-auto bg-[#FDE68A] text-[#92400E] text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
                      Mengirim...
                    </div>
                  )}
                  {currentAnswer && isCorrectOpt && currentAnswer.result.xp_gained > 0 && isSelected && (
                    <div className="ml-auto bg-[#FDE68A] text-[#92400E] text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
                      +{currentAnswer.result.xp_gained} XP
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {error && (
             <div className="mb-6 text-center text-[#D67B7B] font-sans text-sm">{error}</div>
          )}

          {/* AI Insight */}
          {currentAnswer && (
            <div className="bg-[#FBE9B6] rounded-2xl p-6 mb-10 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2 font-sans font-bold text-[#8B6340]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Insight
                </div>
                <div className="flex gap-2">
                  {['eli5', 'standard', 'teknikal'].map(mode => (
                    <button 
                      key={mode}
                      onClick={() => handleAelQuery(mode)}
                      className={`rounded-full px-4 py-1 text-[11px] font-bold capitalize transition-colors
                        ${currentAnswer.aelMode === mode 
                          ? 'bg-[#8B6340] text-white border border-[#8B6340]' 
                          : 'bg-transparent text-[#8B6340] border border-[#D9B76A] hover:bg-[#F5D783]'}`}
                    >
                      {mode === 'eli5' ? 'ELI5' : mode}
                    </button>
                  ))}
                </div>
              </div>
              <div className="font-sans text-[14px] text-[#5C3D1A] leading-relaxed">
                {currentAnswer.aiInsight ? (
                  <ReactMarkdown>{currentAnswer.aiInsight}</ReactMarkdown>
                ) : (
                  <div className="flex items-center gap-2 animate-pulse text-[#C8922A]">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Menyusun insight...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-6 mt-6 border-t border-[#F0EBE1]">
            <div />
            <div className="flex gap-3">
              <button 
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className={`border border-[#D9CDB8] text-[#8B6340] px-6 py-2.5 rounded-xl font-sans font-bold text-sm transition-colors ${currentIndex === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#FDFBF7]'}`}
              >
                &larr; Sebelumnya
              </button>
              <button 
                onClick={() => {
                  if (currentIndex < quests.length - 1) {
                    setCurrentIndex(prev => prev + 1)
                  } else {
                    router.push(`/session/${pin}`)
                  }
                }}
                className="bg-[#C8922A] hover:bg-[#A67520] text-white px-6 py-2.5 rounded-xl font-sans font-bold text-sm transition-colors flex items-center gap-2"
              >
                {currentIndex < quests.length - 1 ? 'Selanjutnya \u2192' : 'Selesai \u2192'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
