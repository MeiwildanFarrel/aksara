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
}

export default function QuestPage({ params }: { params: { pin: string, nodeId: string } }) {
  const router = useRouter()
  const { pin, nodeId } = params

  const [quests, setQuests] = useState<Quest[]>([])
  const [nodeData, setNodeData] = useState<NodeData | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const [strikeCount, setStrikeCount] = useState(0)
  const [aelMode, setAelMode] = useState('standard')
  const [isQueryingAel, setIsQueryingAel] = useState(false)

  useEffect(() => {
    async function loadQuests() {
      try {
        const supabase = createClient()
        const [questRes, nodeRes] = await Promise.all([
          fetch(`/api/quest/${nodeId}`),
          supabase.from('skill_nodes').select('title').eq('id', nodeId).single()
        ])

        if (!questRes.ok) throw new Error('Gagal memuat quest')
        
        const data = await questRes.json()
        setQuests(data)
        
        if (nodeRes.data) {
          setNodeData(nodeRes.data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      } finally {
        setIsLoading(false)
      }
    }
    loadQuests()
  }, [nodeId])

  async function handleSubmit() {
    if (selectedIndex === null) return
    const currentQuest = quests[currentIndex]
    
    setIsSubmitting(true)
    setError(null)

    try {
      const sessionRes = await fetch(`/api/session/${pin}`)
      const sessionData = await sessionRes.json()

      const res = await fetch('/api/quest/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quest_id: currentQuest.id,
          selected_index: selectedIndex,
          session_id: sessionData.id
        })
      })

      if (!res.ok) throw new Error('Gagal mengirim jawaban')
      
      const data: SubmitResponse = await res.json()
      setResult(data)

      if (!data.is_correct) {
        setStrikeCount(prev => prev + 1)
      } else {
        setStrikeCount(0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAelQuery(mode: string) {
    setAelMode(mode)
    setIsQueryingAel(true)
    
    try {
      const sessionRes = await fetch(`/api/session/${pin}`)
      const sessionData = await sessionRes.json()

      const res = await fetch('/api/ael/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: quests[currentIndex].question,
          session_id: sessionData.id,
          mode
        })
      })

      if (res.ok) {
        const data = await res.json()
        setResult(prev => prev ? { ...prev, feedback: data.answer } : null)
      }
    } finally {
      setIsQueryingAel(false)
    }
  }

  function handleNext() {
    if (currentIndex < quests.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setSelectedIndex(null)
      setResult(null)
    } else {
      router.push(`/session/${pin}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-golden-ink border-t-transparent" />
          <p className="font-sans text-sm text-ink-brown animate-pulse">Memuat quest...</p>
        </div>
      </div>
    )
  }

  if (quests.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white">
        <div className="text-center animate-scale-in">
          <div className="mb-6 relative h-24 w-24 mx-auto opacity-40 grayscale animate-float">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" />
          </div>
          <h2 className="font-heading text-2xl font-bold text-ink-dark">Belum ada Quest</h2>
          <button onClick={() => router.push(`/session/${pin}`)} className="mt-6 font-sans font-semibold text-golden-ink hover:text-deep-gold transition-colors">
            ← Kembali ke Skill Tree
          </button>
        </div>
      </div>
    )
  }

  const currentQuest = quests[currentIndex]

  return (
    <div className="min-h-screen bg-warm-white text-ink-dark">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-sand-light bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <button onClick={() => router.push(`/session/${pin}`)} className="rounded-xl p-2 text-ink-brown hover:bg-lontar-pale hover:text-ink-dark transition-all">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div className="text-center">
            <div className="font-heading font-bold text-base leading-tight">{nodeData?.title || 'Loading...'}</div>
            <div className="font-sans text-[10px] font-semibold text-golden-ink uppercase tracking-widest mt-0.5">Quest Mode</div>
          </div>
          <div className="font-sans text-xs font-bold text-ink-brown bg-lontar-pale px-3 py-1.5 rounded-lg">
            {currentIndex + 1}/{quests.length}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-sand-light w-full">
          <div 
            className="h-full bg-gradient-to-r from-golden-ink to-bright-gold transition-all duration-500 ease-out" 
            style={{ width: `${((currentIndex) / quests.length) * 100}%` }} 
          />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 pb-32">
        {/* Question Card */}
        <div className="glass-strong rounded-3xl p-8 mb-8 animate-fade-in-up relative overflow-hidden">
          <div className="absolute inset-0 lontar-pattern" />
          <div className="relative z-10">
            <div className="mb-5 badge-aktif inline-flex uppercase tracking-wider text-[10px]">
              {currentQuest.bloom_level}
            </div>
            <h2 className="font-heading text-2xl leading-relaxed text-ink-dark">{currentQuest.question}</h2>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {currentQuest.options.map((option, idx) => {
            const isSelected = selectedIndex === idx
            const isCorrect = result?.correct_index === idx
            const isWrongSelected = result && !result.is_correct && isSelected

            let btnClass = "group w-full rounded-2xl border-2 p-5 text-left transition-all duration-300 font-sans text-sm "
            
            if (!result) {
              btnClass += isSelected 
                ? "border-golden-ink bg-gold-tint/15 shadow-gold scale-[1.01]" 
                : "border-sand-light bg-white hover:bg-lontar-pale hover:border-muted-tan shadow-sm hover:shadow-md"
            } else {
              if (isCorrect) {
                btnClass += "border-mastery-dikuasai bg-mastery-dikuasai/8 shadow-md font-semibold"
              } else if (isWrongSelected) {
                btnClass += "border-mastery-lemah bg-mastery-lemah/8"
              } else {
                btnClass += "border-sand-light/50 bg-white/50 opacity-40"
              }
            }

            return (
              <button
                key={idx}
                onClick={() => !result && setSelectedIndex(idx)}
                disabled={result !== null}
                className={btnClass}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 font-bold text-sm transition-all
                    ${!result && isSelected 
                      ? 'border-golden-ink bg-golden-ink text-white shadow-gold' 
                      : result && isCorrect 
                        ? 'border-mastery-dikuasai bg-mastery-dikuasai text-white'
                        : result && isWrongSelected
                          ? 'border-mastery-lemah bg-mastery-lemah text-white'
                          : 'border-sand-light bg-warm-white text-ink-brown group-hover:border-muted-tan'
                    }`}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span className="leading-relaxed">{option}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-8 rounded-2xl bg-mastery-lemah/10 p-5 text-mastery-lemah border border-mastery-lemah/20 font-sans text-sm font-medium animate-fade-in">
            {error}
          </div>
        )}

        {/* Feedback Section - Wrong Answer */}
        {result && !result.is_correct && (
          <div className="mt-10 animate-fade-in-up">
            <div className="rounded-3xl border border-mastery-lemah/20 bg-white shadow-card overflow-hidden">
              {/* Header bar */}
              <div className="bg-mastery-lemah/8 px-8 py-5 border-b border-mastery-lemah/10">
                <h3 className="flex items-center gap-3 font-heading text-lg font-bold text-mastery-lemah">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" /></svg>
                  Jawaban Kurang Tepat
                </h3>
              </div>
              
              <div className="p-8">
                {/* AI Feedback */}
                {result.feedback && (
                  <div className="prose prose-stone max-w-none font-sans text-ink-brown leading-relaxed mb-8">
                    {isQueryingAel ? (
                      <div className="flex animate-pulse items-center gap-3 font-medium text-golden-ink">
                        <div className="h-5 w-5 rounded-full border-2 border-golden-ink border-t-transparent animate-spin" />
                        AI sedang menyusun ulang penjelasan...
                      </div>
                    ) : (
                      <ReactMarkdown>{result.feedback}</ReactMarkdown>
                    )}
                  </div>
                )}

                {/* Mode Selection */}
                <div className="rounded-2xl bg-lontar-pale/50 p-5 border border-sand-light">
                  <p className="mb-3 font-sans text-xs font-bold text-ink-dark uppercase tracking-wide">Gaya Penjelasan AI Tutor</p>
                  <div className="flex flex-wrap gap-2">
                    {['standard', 'eli5', 'teknikal', 'drill'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => handleAelQuery(mode)}
                        className={`rounded-xl px-4 py-2 font-sans text-xs font-bold capitalize transition-all duration-200
                          ${aelMode === mode 
                            ? 'bg-golden-ink text-white shadow-gold' 
                            : 'bg-white text-ink-brown hover:bg-warm-white hover:text-ink-dark border border-sand-light hover:border-muted-tan'}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Strike Warning */}
                {strikeCount >= 3 && (
                  <div className="mt-6 rounded-2xl bg-mastery-aktif/10 p-5 border border-mastery-aktif/20 flex items-start gap-4 animate-fade-in">
                     <span className="text-2xl">💡</span>
                     <p className="font-sans text-sm font-medium text-ink-brown">Sepertinya kamu kesulitan di konsep ini. Dosen telah diberitahu untuk membantumu. Mau lewati soal ini dulu?</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Section */}
        {result && result.is_correct && (
          <div className="mt-10 animate-fade-in-up rounded-3xl border border-mastery-dikuasai/30 bg-white shadow-card p-10 text-center relative overflow-hidden">
            {/* Top accent */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-mastery-dikuasai via-mastery-dikuasai/80 to-mastery-dikuasai" />
            
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-mastery-dikuasai/10 text-mastery-dikuasai">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="font-heading text-3xl font-bold text-ink-dark mb-3">Tepat Sekali!</h3>
            <div className="flex items-center justify-center gap-3 font-sans">
              <span className="badge-dikuasai !text-sm">+{result.xp_gained} XP</span>
              <span className="badge-aktif !text-sm">Mastery: {(result.new_mastery_score * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 w-full border-t border-sand-light bg-white/95 backdrop-blur-xl p-5 shadow-[0_-8px_30px_rgba(44,26,8,0.05)]">
        <div className="mx-auto flex max-w-3xl justify-between items-center">
          <div className="font-sans text-sm font-bold text-ink-brown">
            {strikeCount > 0 ? (
              <span className="text-mastery-lemah">{strikeCount} Kesalahan beruntun</span>
            ) : (
              <span className="text-golden-ink">✨ Fokus!</span>
            )}
          </div>
          
          {!result ? (
            <button
              onClick={handleSubmit}
              disabled={selectedIndex === null || isSubmitting}
              className="btn-gold !rounded-2xl !px-10 !py-3.5"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Mengirim...
                </span>
              ) : 'Submit Jawaban'}
            </button>
          ) : result.is_correct || strikeCount >= 3 ? (
            <button
              onClick={handleNext}
              className="rounded-2xl bg-mastery-dikuasai px-10 py-3.5 font-sans font-bold text-white transition-all hover:bg-green-700 shadow-lg"
            >
              {currentIndex < quests.length - 1 ? 'Soal Berikutnya →' : 'Kembali ke Skill Tree'}
            </button>
          ) : (
            <button
              onClick={() => {
                setResult(null); setSelectedIndex(null);
              }}
              className="rounded-2xl border-2 border-golden-ink bg-white px-10 py-3.5 font-sans font-bold text-golden-ink transition-all hover:bg-gold-tint/10 hover:shadow-gold"
            >
              Coba Lagi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
