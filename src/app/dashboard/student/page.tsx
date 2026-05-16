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
  
  const [mmrData, setMmrData] = useState({
    mmr: 0, tier: 'Bronze', next: { label: 'Silver', target: 1500 },
    progressToNext: 0, winRate: 0, difficultyClimb: 0, streak: 0, totalQuiz: 0,
    division: 'NOVICE SCHOLAR'
  })
  const [questTerakhir, setQuestTerakhir] = useState<{ topicTitle: string; results: boolean[]; nodeId: string } | null>(null)
  const [resumeNode, setResumeNode] = useState<{ nodeId: string; nodeTitle: string; sessionPin: string; score: number } | null>(null)
  const [pinInput, setPinInput] = useState('')

  useEffect(() => {
    async function checkUser() {
      const res = await fetch('/api/user/me')
      if (res.ok) setUser(await res.json())
      setIsCheckingSession(false)
    }
    checkUser()
    
    async function loadSessionsAndStats() {
      const saved = localStorage.getItem('student_sessions')
      let sessionsList = []
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
            sessionsList = parsed.filter((s: any) => activeIds.has(s.id))
            setJoinedSessions(sessionsList)
            if (sessionsList.length > 0) {
               // Sessions loaded — topics used elsewhere if needed
            }
          } else {
            setJoinedSessions([])
          }
        }
      }
      
      // Calculate MMR and stats
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        const { data: scores } = await supabase.from('mastery_scores').select('score').eq('user_id', auth.user.id)
        const hasScores = !!scores && scores.length > 0
        let avg = 0
        let winRate = 0
        if (hasScores) {
           avg = scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / scores.length
           winRate = Math.round((scores.filter((s: any) => s.score >= 0.85).length / scores.length) * 100) || 0
        }
        const mmr = hasScores ? Math.max(0, Math.round(avg * 2900)) : 0

        let tier = 'Bronze'
        let next = { label: 'Silver', target: 1500 }
        let division = 'NOVICE SCHOLAR'
        if (mmr >= 2800) { tier = 'Diamond'; next = { label: 'Max Rank', target: 2900 }; division = 'MASTER SCHOLAR' }
        else if (mmr >= 2400) { tier = 'Platinum'; next = { label: 'Diamond', target: 2800 }; division = 'ELITE SCHOLAR' }
        else if (mmr >= 1800) { tier = 'Gold'; next = { label: 'Platinum', target: 2400 }; division = 'ADEPT SCHOLAR' }
        else if (mmr >= 1500) { tier = 'Silver'; next = { label: 'Gold', target: 1800 }; division = 'APPRENTICE SCHOLAR' }

        let progressToNext = 0
        if (mmr >= 2800) progressToNext = 100
        else if (tier === 'Bronze') progressToNext = Math.round((mmr / 1500) * 100)
        else if (tier === 'Silver') progressToNext = Math.round(((mmr - 1500) / 300) * 100)
        else if (tier === 'Gold') progressToNext = Math.round(((mmr - 1800) / 600) * 100)
        else if (tier === 'Platinum') progressToNext = Math.round(((mmr - 2400) / 400) * 100)

        // Count total quests available across all joined sessions
        let totalQuizCount = 0
        const savedSessions = localStorage.getItem('student_sessions')
        if (savedSessions) {
          const parsedSessions = JSON.parse(savedSessions)
          const sessionIds = parsedSessions.map((s: any) => s.id)
          if (sessionIds.length > 0) {
            const { data: nodeIds } = await (supabase as any)
              .from('skill_nodes')
              .select('id')
              .in('session_id', sessionIds)
            if (nodeIds && nodeIds.length > 0) {
              const nids = nodeIds.map((n: any) => n.id)
              const { count: questCount } = await (supabase as any)
                .from('quests')
                .select('*', { count: 'exact', head: true })
                .in('node_id', nids)
              totalQuizCount = questCount || 0
            }
          }
        }

        // Streak & difficulty are derived from real activity — zero for new accounts
        const difficultyClimb = totalQuizCount > 0 ? Math.max(1, Math.round(avg * 10)) : 0
        const streakData = 0

        setMmrData({
          mmr, tier, next, progressToNext: Math.max(0, Math.min(100, progressToNext)),
          winRate, difficultyClimb,
          streak: streakData, totalQuiz: totalQuizCount,
          division
        } as any)

        // Fetch last quest attempts for "Quest Terakhir" card
        const { data: attempts } = await supabase
          .from('quest_attempts')
          .select('quest_id, is_correct')
          .eq('user_id', auth.user.id)
          .order('attempted_at', { ascending: false })
          .limit(5)

        if (attempts && attempts.length > 0) {
          const questIds = [...new Set(attempts.map((a: any) => a.quest_id).filter(Boolean))]
          if (questIds.length > 0) {
            const { data: quests } = await supabase
              .from('quests').select('id, node_id').in('id', questIds)
            const questNodeMap: Record<string, string> = {}
            ;(quests ?? []).forEach((q: any) => { questNodeMap[q.id] = q.node_id })
            const nodeIds = [...new Set(Object.values(questNodeMap).filter(Boolean))]
            const nodeNameMap: Record<string, string> = {}
            if (nodeIds.length > 0) {
              const { data: nodeDetails } = await supabase
                .from('skill_nodes').select('id, title').in('id', nodeIds)
              ;(nodeDetails ?? []).forEach((n: any) => { nodeNameMap[n.id] = n.title })
            }
            const firstQuestId = attempts[0].quest_id ?? ''
            const firstNodeId = firstQuestId ? (questNodeMap[firstQuestId] ?? '') : ''
            setQuestTerakhir({
              topicTitle: (firstNodeId && nodeNameMap[firstNodeId]) ? nodeNameMap[firstNodeId] : 'Materi Terbaru',
              results: attempts.map((a: any) => a.is_correct ?? false),
              nodeId: firstNodeId,
            })
          }
        }

        // Find partial mastery node for "Lanjutkan Belajar" quick access
        if (scores && scores.length > 0) {
          const { data: partialScore } = await (supabase as any)
            .from('mastery_scores')
            .select('node_id, score')
            .eq('user_id', auth.user.id)
            .gt('score', 0)
            .lt('score', 0.8)
            .order('score', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (partialScore?.node_id) {
            const { data: nodeInfo } = await (supabase as any)
              .from('skill_nodes').select('id, title, session_id')
              .eq('id', partialScore.node_id).maybeSingle()
            if (nodeInfo) {
              const savedSess = JSON.parse(localStorage.getItem('student_sessions') || '[]')
              const matchSession = savedSess.find((s: any) => s.id === nodeInfo.session_id)
              if (matchSession?.pin) {
                setResumeNode({
                  nodeId: partialScore.node_id,
                  nodeTitle: nodeInfo.title,
                  sessionPin: matchSession.pin,
                  score: Math.round((partialScore.score ?? 0) * 100),
                })
              }
            }
          }
        }
      }
    }
    loadSessionsAndStats()
  }, [])

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

  const { mmr, tier, next, progressToNext, winRate, difficultyClimb, totalQuiz, division } = mmrData as any

  return (
    <div className="min-h-screen bg-[#FFF9F2] flex flex-col">

      <StudentNav active="dashboard" user={user ? { ...user, tier } : user} />

      <main className="flex-1 w-full flex flex-col items-center p-6 md:p-10">

        <div className="mb-10 w-full max-w-[1100px] text-left">
          <h1 className="font-heading text-[38px] md:text-[46px] font-bold text-[#A27B2B] mb-2 leading-tight">
            Welcome back, <span className="text-[#322312]">{user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Scholar'}.</span>
          </h1>
          <p className="font-sans text-[16px] text-[#867B6D]">
            {totalQuiz === 0
              ? `Mulai perjalanan kognitif Anda. Selesaikan kuis pertama untuk membuka tier ${next.label}.`
              : `Your cognitive development is flourishing. ${next.label} rank awaits its next evolution.`}
          </p>
        </div>

        {/* Onboarding banner — only when no sessions */}
        {joinedSessions.length === 0 && (
          <div className="w-full max-w-[1100px] mb-8 bg-gradient-to-r from-[#2C1A08] to-[#5C3D1A] rounded-3xl p-7 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6 shadow-lg">
            <div className="flex-1">
              <p className="font-sans text-[11px] font-bold tracking-widest text-[#C8922A] uppercase mb-2">Mulai Perjalanan</p>
              <h2 className="font-heading text-[24px] md:text-[28px] font-bold text-white leading-tight mb-2">
                Masukkan PIN kelas dari dosenmu
              </h2>
              <p className="font-sans text-[13px] text-[#C4A882] leading-relaxed">
                Dapatkan PIN dari dosen Anda untuk bergabung ke sesi dan mulai belajar dengan AI.
              </p>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (pinInput.trim().length === 6) router.push(`/dashboard/student/sessions?pin=${pinInput.trim()}`) }}
              className="flex flex-col sm:flex-row gap-3 w-full md:w-auto"
            >
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full sm:w-40 bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 font-mono text-[20px] tracking-widest text-center font-bold outline-none focus:border-[#C8922A] focus:ring-1 focus:ring-[#C8922A] transition-colors"
              />
              <button
                type="submit"
                disabled={pinInput.length !== 6}
                className="bg-[#C8922A] hover:bg-[#A67520] disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-sans font-bold transition-colors whitespace-nowrap"
              >
                Masuk ke Kelas
              </button>
            </form>
          </div>
        )}

        {/* Lanjutkan Belajar quick access */}
        {resumeNode && (
          <div className="w-full max-w-[1100px] mb-6">
            <button
              onClick={() => router.push(`/session/${resumeNode.sessionPin}/node/${resumeNode.nodeId}/learn`)}
              className="w-full bg-white border border-[#F0EAE1] rounded-2xl px-6 py-4 flex items-center gap-4 hover:shadow-md transition-shadow text-left group"
            >
              <div className="w-12 h-12 rounded-full bg-[#FDE2A6] flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-[#865F1D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[11px] font-bold text-[#9A8F82] uppercase tracking-wider mb-0.5">Lanjutkan Belajar</p>
                <p className="font-sans text-[15px] font-bold text-[#20150A] truncate">{resumeNode.nodeTitle}</p>
                <div className="mt-1 w-full max-w-[200px] bg-[#F2ECE4] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#C8922A] h-full rounded-full" style={{ width: `${resumeNode.score}%` }} />
                </div>
              </div>
              <svg className="w-5 h-5 text-[#C8922A] group-hover:translate-x-1 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-[1100px]">
          
          {/* Cognitive MMR Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-[#F0EAE1] shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-8 flex flex-col md:flex-row gap-8">
            <div className="flex-1 border-b md:border-b-0 md:border-r border-[#F0EAE1] pb-6 md:pb-0 md:pr-8">
              <span className="inline-flex items-center gap-1.5 bg-[#F9E298] text-[#845A17] px-3 py-1 rounded-full text-[12px] font-bold font-sans mb-5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Cognitive MMR
              </span>
              <h2 className="font-heading text-[32px] font-bold text-[#20150A] leading-none mb-1">{tier} Tier</h2>
              <p className="font-sans text-[11px] font-bold tracking-widest text-[#9A8F82] uppercase mb-10">{division} DIVISION</p>
              
              <div className="flex items-end gap-3 mb-4">
                <span className="font-heading text-[54px] font-bold text-[#865F1D] leading-none">{mmr.toLocaleString('en-US')}</span>
              </div>

              <div className="w-full bg-[#F2ECE4] h-[6px] rounded-full overflow-hidden mb-2">
                <div className="bg-[#865F1D] h-full rounded-full" style={{ width: `${progressToNext}%` }}></div>
              </div>
              <p className="font-sans text-[12px] text-[#867B6D] text-right">{next.target - mmr > 0 ? `${next.target - mmr} MMR to ${next.label}` : 'Max Rank Reached'}</p>
            </div>
            
            <div className="flex-1 flex flex-col justify-between py-2 gap-4">
              {[
                { label: 'Win Rate', value: `${winRate}%`, progress: winRate },
                { label: 'Difficulty Climb', value: difficultyClimb > 0 ? `Level ${difficultyClimb}` : '—', progress: difficultyClimb * 10 },
                { label: 'Streak Consistency', value: totalQuiz > 0 ? `${mmrData.streak} Days` : '—', progress: totalQuiz > 0 ? Math.min(100, mmrData.streak * 5) : 0 },
                { label: 'Peer Help Quality', value: totalQuiz > 0 ? 'Top 5%' : '—', progress: totalQuiz > 0 ? 95 : 0 }
              ].map((stat, idx) => (
                <div key={idx} className="w-full">
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-sans text-[13px] font-semibold text-[#5B4E41]">{stat.label}</span>
                    <span className="font-sans text-[13px] font-bold text-[#865F1D]">{stat.value}</span>
                  </div>
                  <div className="w-full bg-[#F6F1EA] h-[5px] rounded-full overflow-hidden">
                    <div className="bg-[#C8A265] h-full rounded-full" style={{ width: `${stat.progress}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier Progression */}
          <div className="bg-[#382818] rounded-3xl p-8 flex flex-col border border-[#4A3724] shadow-lg">
            <h3 className="font-heading text-[22px] font-bold text-[#F8F3EC] mb-6">Tier Progression</h3>
            <div className="flex-1 flex flex-col justify-between relative">
              {/* Connecting line */}
              <div className="absolute left-[20px] top-4 bottom-4 w-[2px] bg-[#4E3B27] z-0"></div>
              
              {['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'].map((t) => {
                const isActive = t === tier
                let mmrRange = ''
                if (t === 'Diamond') mmrRange = '2,800+ MMR'
                else if (t === 'Platinum') mmrRange = '2,400 - 2,799 MMR'
                else if (t === 'Gold') mmrRange = '1,800 - 2,399 MMR'
                else if (t === 'Silver') mmrRange = '1,500 - 1,799 MMR'
                else mmrRange = '0 - 1,499 MMR'

                return (
                  <div key={t} className="flex items-center gap-4 relative z-10 py-2.5 px-3 -mx-3 rounded-2xl group cursor-pointer transition-all duration-300 hover:scale-[1.04] hover:-translate-y-1 hover:bg-[#4E3B27] hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:z-20 border border-transparent hover:border-[#6D4C2B]">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 ${isActive ? 'bg-[#F2D078] border-[3px] border-[#382818] shadow-[0_0_0_2px_#F2D078] group-hover:border-[#4E3B27]' : 'bg-[#4E3B27] group-hover:bg-[#5A4530]'}`}>
                      {t === 'Diamond' && <svg className={`w-4 h-4 transition-colors ${isActive ? 'text-[#845A17]' : 'text-[#8C7A67] group-hover:text-[#F2D078]'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M10 2l6 5-6 11L4 7l6-5z" /></svg>}
                      {t === 'Platinum' && <svg className={`w-4 h-4 transition-colors ${isActive ? 'text-[#845A17]' : 'text-[#8C7A67] group-hover:text-[#F2D078]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}
                      {t === 'Gold' && <svg className={`w-4 h-4 transition-colors ${isActive ? 'text-[#845A17]' : 'text-[#8C7A67] group-hover:text-[#F2D078]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>}
                      {t === 'Silver' && <svg className={`w-4 h-4 transition-colors ${isActive ? 'text-[#845A17]' : 'text-[#8C7A67] group-hover:text-[#F2D078]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>}
                      {t === 'Bronze' && <div className={`w-2.5 h-2.5 rotate-45 transition-colors ${isActive ? 'bg-[#845A17]' : 'border-[2px] border-[#8C7A67] group-hover:border-[#F2D078]'}`}></div>}
                    </div>
                    <span className={`font-sans text-[14px] font-semibold transition-colors duration-300 ${isActive ? 'text-[#F2D078]' : 'text-[#8C7A67] group-hover:text-[#F8F3EC]'}`}>{t}</span>
                    
                    <div className="ml-auto opacity-0 translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 delay-75">
                      <span className="text-[10px] font-bold font-sans text-[#F2D078] bg-[#312213] px-2.5 py-1.5 rounded-md border border-[#5A4530] shadow-inner whitespace-nowrap">
                        {mmrRange}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quest Terakhir Card */}
          <div className="bg-[#FAEFE2] rounded-3xl p-7 border border-[#EFDECD] shadow-sm flex flex-col relative overflow-hidden">
            <h3 className="font-heading text-[22px] font-bold text-[#20150A] mb-1">Quest Terakhir</h3>
            <p className="font-sans text-[13px] text-[#71604F] mb-6 truncate">
              {questTerakhir ? questTerakhir.topicTitle : 'Belum ada quest dikerjakan'}
            </p>

            {!questTerakhir ? (
              <>
                <div className="flex flex-col items-center text-center my-auto py-4 gap-4">
                  <div className="w-16 h-16 rounded-full bg-[#E5D5C1] flex items-center justify-center">
                    <svg className="w-7 h-7 text-[#71604F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <p className="font-sans text-[13px] text-[#71604F] leading-relaxed max-w-[240px]">
                    Mulai kerjakan quest pertama Anda. Skor akan muncul di sini setelah Anda selesai.
                  </p>
                </div>
                <button onClick={() => router.push('/dashboard/student/sessions')} className="mt-auto w-full bg-[#825C17] hover:bg-[#684911] text-white py-3.5 rounded-[14px] font-sans font-bold transition-colors shadow-md text-[14px]">
                  Lihat Sessions
                </button>
              </>
            ) : (
              <>
                <div className="flex justify-between items-end mb-2">
                  <span className="font-sans text-[12px] font-bold text-[#6D5226]">
                    Benar: {questTerakhir.results.filter(Boolean).length} / {questTerakhir.results.length}
                  </span>
                  <span className={`font-sans text-[11px] font-bold ${questTerakhir.results.filter(Boolean).length === questTerakhir.results.length ? 'text-[#1A8B49]' : 'text-[#C8922A]'}`}>
                    {Math.round((questTerakhir.results.filter(Boolean).length / questTerakhir.results.length) * 100)}% Akurasi
                  </span>
                </div>
                <div className="w-full bg-[#E5D5C1] h-2.5 rounded-full overflow-hidden mb-6">
                  <div
                    className="bg-[#C8922A] h-full transition-all duration-700"
                    style={{ width: `${(questTerakhir.results.filter(Boolean).length / questTerakhir.results.length) * 100}%` }}
                  />
                </div>
                <div className="flex gap-2 mb-8">
                  {questTerakhir.results.map((correct, i) => (
                    <div key={i} className={`flex-1 aspect-[5/4] rounded-lg border-2 flex items-center justify-center font-sans text-[12px] font-bold transition-colors ${correct ? 'bg-white border-[#1A8B49] text-[#1A8B49]' : 'bg-[#FDF0F0] border-[#E8B4B8] text-[#C0392B]'}`}>
                      {correct
                        ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      }
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => router.push('/dashboard/student/sessions')}
                  className="mt-auto w-full bg-[#825C17] hover:bg-[#684911] text-white py-3.5 rounded-[14px] font-sans font-bold transition-colors shadow-md text-[14px]"
                >
                  Lanjutkan Quest
                </button>
              </>
            )}
          </div>

          {/* Stats Grid & Scholar Badge Wrapper */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-6 flex-1">
              <div className="bg-white rounded-3xl border border-[#F0EAE1] p-6 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="w-16 h-16 bg-[#FDE2A6] rounded-full flex items-center justify-center text-[#2C1A08] mb-4">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h4 className="font-sans text-[16px] font-bold text-[#20150A] mb-1">Total Quiz</h4>
                <p className="font-sans text-[13px] text-[#9A8F82]">{totalQuiz} Quiz Available</p>
              </div>
              
              <div className="bg-white rounded-3xl border border-[#F0EAE1] p-6 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="w-16 h-16 bg-[#A1EDBB] rounded-full flex items-center justify-center text-[#2C1A08] mb-4">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                </div>
                <h4 className="font-sans text-[16px] font-bold text-[#20150A] mb-1">Banyak Courses</h4>
                <p className="font-sans text-[13px] text-[#9A8F82]">lebih dari {joinedSessions.length} course diakses</p>
              </div>
            </div>

            {/* Scholar Badge */}
            <div className="bg-[#24170A] rounded-3xl p-8 border border-[#3E2A18] shadow-lg flex flex-col justify-center relative overflow-hidden group cursor-pointer hover:border-[#6D4C2B] transition-colors flex-1 min-h-[180px]">
              {/* Background watermark */}
              <svg className="absolute -right-6 -bottom-6 w-48 h-48 text-[#FFFFFF] opacity-[0.03] rotate-12 transition-transform group-hover:rotate-45 duration-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              
              <div className="relative z-10">
                <h3 className="font-heading text-[26px] font-bold text-[#F8F3EC] mb-3">Aksara Scholar Badge</h3>
                <p className="font-sans text-[15px] text-[#A6998A] leading-relaxed">
                  {totalQuiz === 0
                    ? 'Belum ada pencapaian. Selesaikan kuis pertama Anda untuk membuka badge perdana sebagai Aksara Scholar.'
                    : mmr < 1500
                      ? `Anda telah menyelesaikan ${totalQuiz} kuis dengan win rate ${winRate}%. Teruskan perjalanan menuju tier Silver untuk membuka badge berikutnya.`
                      : mmr < 1800
                        ? `Anda mencapai tier Silver dengan ${totalQuiz} kuis terselesaikan dan win rate ${winRate}%. ${1800 - mmr} MMR lagi menuju Gold.`
                        : `Anda mencapai tier ${tier} dengan ${totalQuiz} kuis terselesaikan dan win rate ${winRate}%. Pendekatan analitis Anda terhadap tugas kognitif sangat mengesankan.`}
                </p>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  )
}
