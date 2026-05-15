'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/client'
import StudentNav from '../components/StudentNav'

export default function StudentSessions() {
  const router = useRouter()
  const [user, setUser] = useState<any | null>(null)
  const [activeFilter, setActiveFilter] = useState('Semua')
  const [joinedSessions, setJoinedSessions] = useState<any[]>([])
  const [sessionStats, setSessionStats] = useState<Record<string, { nodes: number, completed: number }>>({})
  const [instructorProfiles, setInstructorProfiles] = useState<Record<string, { full_name: string | null, avatar_url: string | null }>>({}) 
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [pinError, setPinError] = useState<string | null>(null)
  const [isPinLoading, setIsPinLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/user/me')
      if (res.ok) setUser(await res.json())

      const saved = localStorage.getItem('student_sessions')
      if (saved) {
        const sessions = JSON.parse(saved)
        
        const supabase = createClient()
        const sessionIds = sessions.map((s: any) => s.id)
        if (sessionIds.length > 0) {
           const { data: activeSessions } = await (supabase as any)
             .from('sessions')
             .select('id, status')
             .in('id', sessionIds)
             .eq('status', 'Active')
             
           if (activeSessions) {
             const activeIds = new Set(activeSessions.map((s: any) => s.id))
             const filteredSessions = sessions.filter((s: any) => activeIds.has(s.id))
             setJoinedSessions(filteredSessions)

             // Fetch instructor profiles for filtered sessions
             const uniqueInstructorIds = [...new Set(filteredSessions.map((s: any) => s.instructor_id).filter(Boolean))] as string[]
             if (uniqueInstructorIds.length > 0) {
               const { data: usersData } = await supabase
                 .from('users')
                 .select('id, full_name, avatar_url')
                 .in('id', uniqueInstructorIds)
               
               if (usersData) {
                 const profiles: Record<string, { full_name: string | null, avatar_url: string | null }> = {}
                 usersData.forEach((u: any) => { profiles[u.id] = { full_name: u.full_name, avatar_url: u.avatar_url } })
                 setInstructorProfiles(profiles)
               }
             }
           }
        }
      }
    }
    init()
  }, [])

  useEffect(() => {
    async function loadStats() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const stats: Record<string, { nodes: number, completed: number }> = {}

      for (const s of joinedSessions) {
        const { data: nodes } = await supabase
          .from('skill_nodes')
          .select('id')
          .eq('session_id', s.id)
        
        const nodeCount = nodes?.length || 0
        let completedCount = 0

        if (nodeCount > 0 && nodes) {
          const nodeIds = nodes.map(n => n.id)
          const { data: mastery } = await supabase
            .from('mastery_scores')
            .select('node_id, score')
            .eq('user_id', user.id)
            .in('node_id', nodeIds)

          completedCount = mastery?.filter(m => (m.score ?? 0) > 0).length || 0
        }
        stats[s.id] = { nodes: nodeCount, completed: completedCount }
      }
      setSessionStats(stats)
    }
    
    if (joinedSessions.length > 0) {
      loadStats()
    }
  }, [joinedSessions])

  // --- PIN Input Handlers ---
  const handlePinChange = (index: number, value: string) => {
    const upperVal = value.toUpperCase()
    if (!/^[\d\w]*$/.test(upperVal)) return

    const newPin = [...pin]
    newPin[index] = upperVal
    setPin(newPin)
    setPinError(null)

    if (upperVal !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && pin[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '')
    if (pastedData) {
      const newPin = [...pin]
      for (let i = 0; i < pastedData.length; i++) {
        newPin[i] = pastedData[i]
      }
      setPin(newPin)
      if (pastedData.length === 6) {
        inputRefs.current[5]?.focus()
      } else {
        inputRefs.current[pastedData.length]?.focus()
      }
    }
  }

  const handleJoinSession = async () => {
    const fullPin = pin.join('')
    if (fullPin.length < 6) {
      setPinError('PIN harus 6 digit.')
      return
    }

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
          setJoinedSessions(existing)
        }

        // Close modal and reset pin
        setIsModalOpen(false)
        setPin(['', '', '', '', '', ''])
      } else {
        const data = await res.json()
        setPinError(data.error || 'Gagal menemukan sesi.')
      }
    } catch (err) {
      setPinError('Terjadi kesalahan jaringan.')
    } finally {
      setIsPinLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0] flex flex-col items-center">
      
      <StudentNav active="sessions" user={user} />

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1200px] px-8 py-12">
        {/* Page Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1 className="font-heading text-[32px] font-bold text-[#2C1A08] mb-2">Materi & Quest Saya</h1>
            <p className="font-sans text-[15px] text-[#5C3D1A]">Lanjutkan perjalanan intelektual Anda hari ini.</p>
          </div>
          
          {/* Filters */}
          <div className="flex bg-[#F5EFE4] rounded-xl p-1 border border-[#EDE4D3]">
            {['Semua', 'Sedang Dipelajari', 'Selesai'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-5 py-2 rounded-lg font-sans text-[13px] font-semibold transition-all ${
                  activeFilter === filter 
                    ? 'bg-white text-[#2C1A08] shadow-sm' 
                    : 'text-[#8B6340] hover:text-[#5C3D1A]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Dynamic Sessions */}
          {joinedSessions.map((session, i) => {
            const stats = sessionStats[session.id] || { nodes: 0, completed: 0 }
            const progress = stats.nodes > 0 ? Math.round((stats.completed / stats.nodes) * 100) : 0
            const isCompleted = stats.nodes > 0 && stats.completed === stats.nodes

            if (activeFilter === 'Selesai' && !isCompleted) return null
            if (activeFilter === 'Sedang Dipelajari' && (progress === 0 || isCompleted)) return null

            return (
              <div key={session.id} className="bg-white rounded-3xl p-8 border border-[#EDE4D3] shadow-[0_2px_20px_rgb(44,26,8,0.04)] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#FAE8B0]/50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#A67520]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  {isCompleted ? (
                    <span className="px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-bold font-sans">Selesai</span>
                  ) : progress > 0 ? (
                    <span className="px-3 py-1 rounded-full bg-[#E3F2FD] text-[#1565C0] text-[11px] font-bold font-sans">Sedang Dipelajari</span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-[#FFF3E0] text-[#E67E22] text-[11px] font-bold font-sans">Baru</span>
                  )}
                </div>
                <h2 className="font-heading text-[22px] font-bold text-[#2C1A08] leading-tight mb-2">{session.title}</h2>
                
                {/* Instructor Info */}
                {(() => {
                  const iProfile = instructorProfiles[session.instructor_id]
                  const name = iProfile?.full_name || session.users?.email?.split('@')[0] || 'Dosen Aksara'
                  const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                  return (
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-7 h-7 rounded-full bg-[#FAF3EC] border border-[#E8DCCB] flex items-center justify-center text-[10px] font-bold text-[#8B6340] overflow-hidden shrink-0">
                        {iProfile?.avatar_url ? (
                          <img src={iProfile.avatar_url} alt={name} className="w-full h-full object-cover" />
                        ) : initials}
                      </div>
                      <p className="font-sans text-[13px] text-[#5C3D1A]">Instructor: <span className="font-semibold">{name}</span></p>
                    </div>
                  )
                })()}
                
                <div className="mt-auto">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-sans text-[12px] text-[#8B6340]">Progress Belajar</span>
                    <span className={`font-sans text-[12px] font-bold ${isCompleted ? 'text-[#2E7D32]' : 'text-[#A67520]'}`}>{progress}%</span>
                  </div>
                  <div className="w-full bg-[#EDE4D3] h-2 rounded-full mb-4 overflow-hidden">
                    <div className={`${isCompleted ? 'bg-[#196F3D]' : 'bg-[#C8922A]'} h-full rounded-full transition-all duration-500`} style={{ width: `${progress}%` }}></div>
                  </div>
                  
                  <div className="flex gap-4 mb-6">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-[#A67520]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="font-sans text-[12px] text-[#5C3D1A]">{stats.nodes} Nodes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-[#A67520]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      <span className="font-sans text-[12px] text-[#5C3D1A]">{stats.nodes} Quests</span>
                    </div>
                  </div>
                  
                  <button onClick={() => router.push(`/session/${session.pin}`)} className="w-full bg-[#C8922A] hover:bg-[#A67520] text-white py-3 rounded-xl font-sans font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm">
                    {progress > 0 ? 'Lanjutkan Sesi' : 'Mulai Sesi'}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}

          {/* Card Add New PIN (Image 1) */}
          {(activeFilter === 'Semua') && (
            <div className="bg-[#261705] rounded-3xl p-8 border border-[#3E2610] shadow-lg flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute top-4 right-4 opacity-10">
                 <svg className="w-48 h-48 text-[#EAB308]" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 7h2v6h-2zm0 8h2v2h-2z" />
                   <path d="M4 10h16v4H4z" />
                 </svg>
              </div>
              
              <div className="relative z-10 w-full flex flex-col items-center">
                <div className="mb-4 text-[#EAB308]">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="font-heading text-[26px] font-bold text-[#EAB308] leading-tight mb-3">Tambah Topik Baru?</h2>
                <p className="font-sans text-[15px] text-[#A69C8E] mb-8 leading-relaxed px-2">
                  Temukan ratusan materi dan quest yang dikurasi oleh pakar akademis terbaik.
                </p>
                <button onClick={() => setIsModalOpen(true)} className="w-full bg-[#EAB308] hover:bg-[#D9A006] text-[#261705] py-3.5 rounded-3xl font-sans font-bold transition-colors shadow-sm text-sm">
                  Tambah PIN Code Baru
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Modal PIN Input (Image 2) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FBF7F0]/90 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full shadow-2xl border border-[#EDE4D3] text-center relative flex flex-col items-center animate-in fade-in zoom-in duration-300">
            
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
                const isError = pinError !== null;
                const baseInputClass = "w-11 h-12 md:w-12 md:h-14 text-center text-xl font-heading rounded-lg outline-none transition-all duration-200";
                let specificClass = "bg-[#FDFBF7] border border-[#E5DAC6] text-[#2C1A08] focus:border-[#4285F4] focus:ring-1 focus:ring-[#4285F4]";

                if (isError) {
                  specificClass = "bg-[#FDEDEC] border border-[#C0392B] text-[#C0392B] focus:border-[#C0392B] focus:ring-1 focus:ring-[#C0392B]";
                }

                return (
                  <input
                    key={idx}
                    ref={el => { inputRefs.current[idx] = el }}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className={`${baseInputClass} ${specificClass}`}
                    autoFocus={idx === 0}
                  />
                )
              })}
            </div>

            <div className={`h-5 mb-6 flex items-center justify-center transition-opacity ${pinError ? 'opacity-100' : 'opacity-0'}`}>
              <p className="font-sans text-[12px] font-semibold text-[#C0392B]">{pinError}</p>
            </div>

            <button
              onClick={handleJoinSession}
              disabled={isPinLoading || pin.join('').length !== 6}
              className="w-full bg-[#C8922A] hover:bg-[#A67520] text-white py-3 rounded-xl font-sans font-semibold transition-colors disabled:opacity-50 text-[14px]"
            >
              {isPinLoading ? 'Mengecek...' : 'Konfirmasi'}
            </button>

            <button 
              onClick={() => setIsModalOpen(false)}
              className="mt-6 font-sans text-[12px] font-semibold text-[#5C3D1A] hover:text-[#2C1A08] transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Batal dan Kembali ke Pustaka
            </button>

          </div>
          
          <div className="absolute bottom-10 flex items-center gap-1.5 opacity-40">
             <div className="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
             <div className="w-2 h-2 rounded-full bg-[#D4AF37] opacity-60"></div>
             <div className="w-2 h-2 rounded-full bg-[#D4AF37] opacity-30"></div>
          </div>
        </div>
      )}
    </div>
  )
}
