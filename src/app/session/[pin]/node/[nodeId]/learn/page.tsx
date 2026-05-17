'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface FlashCard { front: string; back: string }

interface NodeSummaryData {
  id: string
  title: string
  summary: string | null
  key_points: string[]
  flash_cards: FlashCard[]
  quest_count: number
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-[#E8DCCB] rounded-xl animate-pulse ${className ?? ''}`} />
}

export default function LearnPage({ params }: { params: { pin: string; nodeId: string } }) {
  const router = useRouter()
  const { pin, nodeId } = params

  const [data, setData] = useState<NodeSummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cardIndex, setCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch(`/api/session/${pin}/nodes/${nodeId}/summary`)
        if (!res.ok) throw new Error('Gagal memuat materi')
        const json = await res.json()
        console.log('node summary response:', json)

        // Normalize key_points — terima array apapun tipenya, convert ke string
        const rawKp: unknown = json.key_points
        let key_points: string[]
        if (Array.isArray(rawKp)) {
          key_points = rawKp.map((p: unknown) => String(p)).filter(Boolean)
        } else if (typeof rawKp === 'string' && rawKp.trimStart().startsWith('[')) {
          try {
            const parsed: unknown = JSON.parse(rawKp)
            key_points = Array.isArray(parsed) ? parsed.map((p: unknown) => String(p)).filter(Boolean) : []
          } catch {
            key_points = []
          }
        } else {
          key_points = []
        }

        // Normalize flash_cards — selalu array, cegah crash jika null dari API
        const rawFc: unknown = json.flash_cards
        const flash_cards: FlashCard[] = Array.isArray(rawFc)
          ? rawFc.filter(
              (fc: unknown): fc is FlashCard =>
                fc != null &&
                typeof fc === 'object' &&
                typeof (fc as Record<string, unknown>).front === 'string' &&
                typeof (fc as Record<string, unknown>).back === 'string',
            )
          : []

        console.log('key_points:', key_points, '| flash_cards:', flash_cards.length)

        setData({ ...json, key_points, flash_cards })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      } finally {
        setIsLoading(false)
      }
    }
    fetchSummary()
  }, [pin, nodeId])

  const cards = data?.flash_cards ?? []
  const currentCard = cards[cardIndex]
  const totalCards = cards.length

  function prevCard() { setCardIndex(i => Math.max(0, i - 1)); setIsFlipped(false) }
  function nextCard() { setCardIndex(i => Math.min(totalCards - 1, i + 1)); setIsFlipped(false) }

  return (
    <div className="min-h-screen bg-[#FBF7F0] text-[#2C1A08] font-sans pb-16">
      {/* Top nav */}
      <div className="sticky top-0 z-10 bg-[#FBF7F0] border-b border-[#EDE4D3] px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push(`/session/${pin}`)}
          className="p-2 rounded-xl hover:bg-[#EDE4D3] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-[#5C3D1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <SkeletonBlock className="h-5 w-48" />
          ) : (
            <h1 className="font-heading text-[18px] font-bold truncate">{data?.title}</h1>
          )}
        </div>
        {!isLoading && data && (
          <span className="text-[12px] font-bold text-[#8B6340] bg-[#F5EFE9] px-3 py-1.5 rounded-full whitespace-nowrap">
            {data.quest_count} quest
          </span>
        )}
      </div>

      <main className="max-w-[760px] mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Summary */}
        <section className="bg-white rounded-2xl border border-[#EDE4D3] p-7 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#FDE2A6] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#865F1D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="font-heading text-[18px] font-bold">Ringkasan Materi</h2>
          </div>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-5/6" />
              <SkeletonBlock className="h-4 w-4/5" />
            </div>
          ) : (
            <p className="font-sans text-[15px] text-[#5C3D1A] leading-[1.8]">
              {data?.summary || 'Ringkasan belum tersedia untuk topik ini.'}
            </p>
          )}
        </section>

        {/* Key Points */}
        <section className="bg-white rounded-2xl border border-[#EDE4D3] p-7 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-full bg-[#D1FAE5] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#065F46]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h2 className="font-heading text-[18px] font-bold">Poin Kunci</h2>
          </div>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#E8DCCB] mt-2 shrink-0 animate-pulse" />
                  <SkeletonBlock className={`h-4 flex-1 ${i % 3 === 0 ? 'w-3/4' : 'w-full'}`} />
                </div>
              ))}
            </div>
          ) : data?.key_points && data.key_points.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {data.key_points.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-[#C8922A] text-[16px] mt-0.5 shrink-0">●</span>
                  <span className="font-sans text-[14px] text-[#5C3D1A] leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-sans text-[14px] text-[#8B6340]">Poin kunci belum tersedia.</p>
          )}
        </section>

        {/* Flash Cards */}
        {(isLoading || (data && data.flash_cards.length > 0)) && (
          <section className="bg-white rounded-2xl border border-[#EDE4D3] p-7 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#DBEAFE] flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h7" />
                  </svg>
                </div>
                <h2 className="font-heading text-[18px] font-bold">Flash Cards</h2>
              </div>
              {!isLoading && totalCards > 0 && (
                <span className="font-sans text-[13px] font-bold text-[#8B6340]">
                  {cardIndex + 1} / {totalCards}
                </span>
              )}
            </div>

            {isLoading ? (
              <SkeletonBlock className="h-[180px] w-full rounded-2xl" />
            ) : currentCard ? (
              <>
                {/* Flip card */}
                <div
                  className="relative h-[200px] w-full cursor-pointer select-none"
                  style={{ perspective: '1000px' }}
                  onClick={() => setIsFlipped(f => !f)}
                >
                  <div
                    className="relative h-full w-full transition-all duration-500"
                    style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                  >
                    {/* Front */}
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-[#FFF9F2] border-2 border-[#EDE4D3] p-6 text-center"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <p className="font-sans text-[11px] font-bold uppercase tracking-widest text-[#C8922A] mb-3">Pertanyaan — klik untuk balik</p>
                      <p className="font-sans text-[17px] font-semibold text-[#2C1A08] leading-snug">{currentCard.front}</p>
                    </div>
                    {/* Back */}
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-[#2C1A08] border-2 border-[#2C1A08] p-6 text-center"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <p className="font-sans text-[11px] font-bold uppercase tracking-widest text-[#C8922A] mb-3">Jawaban</p>
                      <p className="font-sans text-[17px] font-semibold text-white leading-snug">{currentCard.back}</p>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-5">
                  <button
                    onClick={prevCard}
                    disabled={cardIndex === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#EDE4D3] font-sans font-semibold text-[13px] text-[#5C3D1A] hover:bg-[#F5EFE9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                  >
                    ← Sebelumnya
                  </button>
                  <div className="flex gap-1.5">
                    {cards.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setCardIndex(i); setIsFlipped(false) }}
                        className={`w-2 h-2 rounded-full transition-colors ${i === cardIndex ? 'bg-[#C8922A]' : 'bg-[#E8DCCB] hover:bg-[#D8C5AA]'}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={nextCard}
                    disabled={cardIndex === totalCards - 1}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#EDE4D3] font-sans font-semibold text-[13px] text-[#5C3D1A] hover:bg-[#F5EFE9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                  >
                    Berikutnya →
                  </button>
                </div>
              </>
            ) : null}
          </section>
        )}

        {error && (
          <div className="bg-[#FDF0F0] border border-[#E8B4B8] rounded-2xl p-5 text-center">
            <p className="font-sans text-[14px] text-[#C0392B]">{error}</p>
          </div>
        )}

        {/* CTA */}
        <div className="pt-2">
          <button
            onClick={() => router.push(`/session/${pin}/node/${nodeId}`)}
            className="w-full bg-[#C8922A] hover:bg-[#A67520] text-white py-4 rounded-2xl font-sans font-bold text-[16px] transition-colors shadow-md flex items-center justify-center gap-3"
          >
            Saya Siap — Kerjakan Quest
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <p className="text-center font-sans text-[12px] text-[#8B6340] mt-3">
            {data?.quest_count ?? '...'} soal menanti — selesaikan semua untuk tingkatkan mastery score
          </p>
        </div>

      </main>
    </div>
  )
}
