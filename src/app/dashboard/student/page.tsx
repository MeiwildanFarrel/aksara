'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/client'
import StudentNav from './components/StudentNav'

export default function StudentDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [joinedSessions, setJoinedSessions] = useState<any[]>([])

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [pinError, setPinError] = useState<string | null>(null)
  const [isPinLoading, setIsPinLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    async function checkUser() {
      const res = await fetch('/api/user/me')
      if (res.ok) setUser(await res.json())
      setIsCheckingSession(false)
    }
    checkUser()
    
    async function loadSessions() {
      const saved = localStorage.getItem('student_sessions')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.length > 0) {
          const supabase = createClient()
          const sessionIds = parsed.map((s: any) => s.id)
          const { data: activeSessions } = await (supabase as any)
            .from('sessions')
            .select('id, status')
            .in('id', sessionIds)
            .eq('status', 'Active')
            
          if (activeSessions) {
            const activeIds = new Set(activeSessions.map((s: any) => s.id))
            setJoinedSessions(parsed.filter((s: any) => activeIds.has(s.id)))
          } else {
            setJoinedSessions([])
          }
        } else {
          setJoinedSessions([])
        }
      }
    }
    loadSessions()
  }, [])

  // PIN handlers
  const handlePinChange = (index: number, value: string) => {
    const upperVal = value.toUpperCase()
    if (!/^[\d\w]*$/.test(upperVal)) return
    const newPin = [...pin]
    newPin[index] = upperVal
    setPin(newPin)
    setPinError(null)
    if (upperVal !== '' && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && pin[index] === '' && index > 0) inputRefs.current[index - 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '')
    if (pastedData) {
      const newPin = [...pin]
      for (let i = 0; i < pastedData.length; i++) newPin[i] = pastedData[i]
      setPin(newPin)
      inputRefs.current[Math.min(pastedData.length, 5)]?.focus()
    }
  }

  const handleJoinSession = async () => {
    const fullPin = pin.join('')
    if (fullPin.length < 6) { setPinError('PIN harus 6 digit.'); return }
    try {
      setIsPinLoading(true)
      const res = await fetch(`/api/session/${fullPin}`)
      if (res.ok) {
        const sessionData = await res.json()
        const existing = JSON.parse(localStorage.getItem('student_sessions') || '[]')
        if (!existing.find((s: any) => s.id === sessionData.id)) {
          sessionData.pin = fullPin
          existing.push(sessionData)
          localStorage.setItem('student_sessions', JSON.stringify(existing))
        }
        setIsModalOpen(false)
        setPin(['', '', '', '', '', ''])
        router.push('/dashboard/student/sessions')
      } else {
        const data = await res.json()
        setPinError(data.error || 'Gagal menemukan sesi.')
      }
    } catch { setPinError('Terjadi kesalahan jaringan.') }
    finally { setIsPinLoading(false) }
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
          <p className="font-sans text-sm text-[#5C3D1A] animate-pulse">Memuat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0] flex flex-col">

      <StudentNav active="dashboard" user={user} />

      {/* Main Content */}
      <main className="flex-1 w-full flex flex-col items-center justify-center p-6 md:p-10">

        {/* Greeting */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-[36px] md:text-[42px] font-bold text-[#2C1A08] mb-2">
            Selamat Datang, <span className="text-[#C8922A]">{user?.full_name || user?.email?.split('@')[0] || 'Pelajar'}</span>
          </h1>
          <p className="font-sans text-[15px] text-[#5C3D1A]">Mulai perjalanan intelektual Anda hari ini.</p>
        </div>

        {/* Two-Card Grid */}
        <div className="grid md:grid-cols-2 gap-8 w-full max-w-[900px]">

          {/* Card 1: Tambah Topik Baru */}
          <div className="bg-[#261705] rounded-3xl p-10 border border-[#3E2610] shadow-lg flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[380px] group cursor-pointer hover:border-[#C8922A]/40 transition-all duration-300" onClick={() => setIsModalOpen(true)}>
            {/* Decorative bg */}
            <div className="absolute -right-8 -top-8 opacity-[0.06]">
              <svg className="w-56 h-56 text-[#C8922A]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <div className="relative z-10 w-full flex flex-col items-center">
              <div className="mb-5 text-[#EAB308]">
                <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="font-heading text-[28px] font-bold text-[#EAB308] leading-tight mb-3">Tambah Topik Baru?</h2>
              <p className="font-sans text-[15px] text-[#A69C8E] mb-8 leading-relaxed px-4">
                Temukan ratusan materi dan quest yang dikurasi oleh pakar akademis terbaik.
              </p>
              <button className="w-full max-w-[280px] bg-[#EAB308] hover:bg-[#D9A006] text-[#261705] py-3.5 rounded-3xl font-sans font-bold transition-colors shadow-sm text-sm group-hover:scale-[1.02] transition-transform duration-200">
                Tambah PIN Code Baru
              </button>
            </div>
          </div>

          {/* Card 2: Daily Quiz */}
          <div className="bg-white rounded-3xl p-10 border border-[#EDE4D3] shadow-[0_2px_20px_rgb(44,26,8,0.06)] flex flex-col relative overflow-hidden min-h-[380px] group">
            {/* Top badge */}
            <div className="flex items-center justify-between mb-6">
              <span className="bg-[#FFF3E0] text-[#E67E22] px-3 py-1 rounded-full text-[11px] font-bold font-sans flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" /></svg>
                Daily Challenge
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold font-sans text-[#C8922A] uppercase tracking-wide">3-Strike Lifelines</span>
              </div>
            </div>

            {/* Hearts */}
            <div className="flex items-center gap-1 mb-6 self-end">
              <svg className="w-5 h-5 text-[#C0392B]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
              <svg className="w-5 h-5 text-[#EDE4D3]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
              <svg className="w-5 h-5 text-[#EDE4D3]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
            </div>

            {/* Mini quiz preview */}
            <div className="bg-[#FDFBF7] rounded-2xl p-5 border border-[#EDE4D3] mb-6 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-[#C8922A] text-white text-[10px] font-bold px-2.5 py-1 rounded-full font-sans">Variant Question A-1</span>
                <div className="ml-auto flex gap-2">
                  <span className="text-[11px] text-[#C8922A] font-sans font-semibold flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    Hint
                  </span>
                </div>
              </div>
              <p className="font-sans text-[13px] text-[#2C1A08] leading-relaxed mb-4">Berdasarkan materi mengenai sistem drainase Candi Borobudur, mengapa restorasi 1973 memprioritaskan...</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 bg-white border border-[#EDE4D3] rounded-xl px-3 py-2.5">
                  <div className="w-4 h-4 rounded-full border-2 border-[#EDE4D3] flex-shrink-0"></div>
                  <span className="font-sans text-[11px] text-[#5C3D1A]">Untuk ritual purifikasi keagamaan...</span>
                </div>
                <div className="flex items-center gap-2.5 bg-[#FAE8B0]/30 border border-[#C8922A]/30 rounded-xl px-3 py-2.5">
                  <div className="w-4 h-4 rounded-full border-2 border-[#C8922A] flex-shrink-0 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#C8922A]"></div>
                  </div>
                  <span className="font-sans text-[11px] text-[#2C1A08] font-semibold">Untuk mengurangi tekanan hidrostatik...</span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-bold font-sans text-[#8B6340] uppercase tracking-wide">Current Node Persistence</span>
                <span className="text-[12px] font-bold font-sans text-[#C8922A]">62% Correctness</span>
              </div>
              <div className="w-full bg-[#EDE4D3] h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-[#8B6340] to-[#C8922A] h-full rounded-full" style={{ width: '62%' }}></div>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => {
                const saved = localStorage.getItem('student_sessions')
                if (saved) {
                  const sessions = JSON.parse(saved)
                  if (sessions.length > 0) {
                    const firstSession = sessions[0]
                    router.push(`/session/${firstSession.pin}`)
                    return
                  }
                }
                setIsModalOpen(true)
              }}
              className="w-full bg-[#C8922A] hover:bg-[#A67520] text-white py-3 rounded-xl font-sans font-semibold transition-colors flex items-center justify-center gap-2 text-[14px]"
            >
              Mulai Daily Quiz
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

        </div>

        {/* Quick access to sessions */}
        {joinedSessions.length > 0 && (
          <div className="mt-10 w-full max-w-[900px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-[18px] font-bold text-[#2C1A08]">Sesi Terakhir</h3>
              <a href="/dashboard/student/sessions" className="text-[13px] font-sans font-semibold text-[#C8922A] hover:text-[#A67520] transition-colors">Lihat Semua →</a>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {joinedSessions.slice(0, 4).map((s: any) => (
                <button key={s.id} onClick={() => router.push(`/session/${s.pin}`)} className="flex-shrink-0 bg-white border border-[#EDE4D3] rounded-xl px-5 py-3 font-sans text-[13px] text-[#2C1A08] font-semibold hover:border-[#C8922A] transition-colors shadow-sm">
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal PIN Input */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FBF7F0]/90 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full shadow-2xl border border-[#EDE4D3] text-center flex flex-col items-center">

            <div className="w-14 h-14 rounded-full bg-[#FAE8B0]/40 flex items-center justify-center mb-6 text-[#A67520]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <h2 className="font-heading text-[28px] font-bold text-[#2C1A08] mb-3">Tambah Topik Baru</h2>
            <p className="font-sans text-[13px] text-[#5C3D1A] mb-8 leading-relaxed max-w-[280px]">
              Silakan masukkan 6 digit kode PIN yang Anda terima untuk membuka akses.
            </p>

            <div className="flex justify-center gap-2.5 mb-2" onPaste={handlePaste}>
              {pin.map((digit, idx) => {
                const isError = pinError !== null
                const base = "w-11 h-12 md:w-12 md:h-14 text-center text-xl font-heading rounded-lg outline-none transition-all duration-200"
                const style = isError
                  ? "bg-[#FDEDEC] border border-[#C0392B] text-[#C0392B] focus:border-[#C0392B] focus:ring-1 focus:ring-[#C0392B]"
                  : "bg-[#FDFBF7] border border-[#E5DAC6] text-[#2C1A08] focus:border-[#4285F4] focus:ring-1 focus:ring-[#4285F4]"
                return (
                  <input key={idx} ref={el => { inputRefs.current[idx] = el }} type="text" maxLength={1} value={digit}
                    onChange={(e) => handlePinChange(idx, e.target.value)} onKeyDown={(e) => handleKeyDown(idx, e)}
                    className={`${base} ${style}`} autoFocus={idx === 0} />
                )
              })}
            </div>

            <div className={`h-5 mb-6 flex items-center justify-center transition-opacity ${pinError ? 'opacity-100' : 'opacity-0'}`}>
              <p className="font-sans text-[12px] font-semibold text-[#C0392B]">{pinError}</p>
            </div>

            <button onClick={handleJoinSession} disabled={isPinLoading || pin.join('').length !== 6}
              className="w-full bg-[#C8922A] hover:bg-[#A67520] text-white py-3 rounded-xl font-sans font-semibold transition-colors disabled:opacity-50 text-[14px]">
              {isPinLoading ? 'Mengecek...' : 'Konfirmasi'}
            </button>

            <button onClick={() => { setIsModalOpen(false); setPin(['', '', '', '', '', '']); setPinError(null) }}
              className="mt-6 font-sans text-[12px] font-semibold text-[#5C3D1A] hover:text-[#2C1A08] transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Batal dan Kembali ke Pustaka
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
