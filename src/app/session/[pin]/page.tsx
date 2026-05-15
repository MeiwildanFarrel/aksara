'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/client'
import StudentNav from '../../dashboard/student/components/StudentNav'

interface Session {
  id: string
  title: string
  pin: string
  description?: string | null
  users?: InstructorProfile | InstructorProfile[] | null
}

interface InstructorProfile {
  id?: string | null
  email?: string | null
  full_name?: string | null
  avatar_url?: string | null
  university?: string | null
}

interface SkillNode {
  id: string
  title: string
  prerequisite_ids: string[] | null
  position_x: number | null
  position_y: number | null
  quest_count?: number
}

interface MasteryMap {
  [nodeId: string]: number // score 0.0 - 1.0
}

export default function SessionDetail({ params }: { params: { pin: string } }) {
  const router = useRouter()
  const { pin } = params
  
  const [session, setSession] = useState<Session | null>(null)
  const [nodes, setNodes] = useState<SkillNode[]>([])
  const [mastery, setMastery] = useState<MasteryMap>({})
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        
        // Fetch User
        const resUser = await fetch('/api/user/me')
        if (resUser.ok) setUser(await resUser.json())

        // Fetch Session
        const sessionRes = await fetch(`/api/session/${pin}`)
        if (!sessionRes.ok) throw new Error('Sesi tidak valid')
        const sessionData: Session = await sessionRes.json()
        setSession(sessionData)

        // Fetch Nodes & Mastery
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const [nodesRes, masteryRes] = await Promise.all([
            fetch(`/api/session/${pin}/nodes`),
            supabase
              .from('mastery_scores')
              .select('node_id, score')
              .eq('user_id', user.id)
          ])

          if (nodesRes.ok) {
            const fetchedNodes = (await nodesRes.json()) as SkillNode[]
            setNodes(fetchedNodes)
          }
          
          const m: MasteryMap = {}
          if (masteryRes.data) {
            masteryRes.data.forEach(item => {
              if (item.node_id) m[item.node_id] = item.score ?? 0
            })
          }
          setMastery(m)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [pin])

  const isNodeUnlocked = (node: SkillNode, index: number) => {
    const prerequisites = node.prerequisite_ids ?? []
    if (prerequisites.length > 0) {
      return prerequisites.every((prerequisiteId) => mastery[prerequisiteId] !== undefined)
    }

    if (index === 0) return true
    const previousNode = nodes[index - 1]
    return previousNode ? mastery[previousNode.id] !== undefined : true
  }

  const instructor = Array.isArray(session?.users) ? session?.users[0] : session?.users
  const instructorName = instructor?.full_name || instructor?.email?.split('@')[0] || 'Dosen Aksara'
  const instructorUniversity = instructor?.university || 'Dosen & Pengajar'
  const instructorInitials = instructorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'D'

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0]">
        <div className="h-16 w-16 animate-spin-slow rounded-full border-2 border-[#EDE4D3] border-t-[#C8922A]" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0] p-6">
        <div className="rounded-3xl border border-[#EDE4D3] bg-white p-10 text-center max-w-md shadow-sm">
          <h2 className="font-heading text-2xl font-bold text-[#2C1A08] mb-2">Gagal Memuat Sesi</h2>
          <p className="font-sans text-sm text-[#8B6340] mb-8">{error}</p>
          <button onClick={() => router.push('/dashboard/student')} className="bg-[#C8922A] text-white px-6 py-2 rounded-lg">
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0] text-[#2C1A08] font-sans pb-20">
      <StudentNav active="sessions" user={user} />

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-12 flex flex-col items-center">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-sans text-[#8B6340] mb-8">
          <span>Materi & Quest Saya</span>
          <span>&gt;</span>
          <span className="text-[#C8922A] font-semibold">{session.title}</span>
        </div>

        {/* Title */}
        <div className="text-center mb-10 w-full max-w-3xl">
          {(() => {
             const parts = session.title.split(':')
             if (parts.length > 1) {
               return (
                 <h1 className="font-heading text-[48px] md:text-[56px] font-bold leading-tight tracking-tight">
                   <span className="text-[#2C1A08] block">{parts[0]}:</span>
                   <span className="text-[#C8922A] block">{parts.slice(1).join(':').trim()}</span>
                 </h1>
               )
             }
             return <h1 className="font-heading text-[48px] md:text-[56px] font-bold text-[#2C1A08] leading-tight tracking-tight">{session.title}</h1>
          })()}
        </div>

        {/* Divider */}
        <div className="w-[60%] max-w-lg h-px bg-[#C8922A] mb-12 opacity-30"></div>

        {/* Author */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-full border border-[#C8922A] mb-4 flex items-center justify-center bg-[#FDFBF7] shadow-sm overflow-hidden text-[#C8922A] font-heading font-bold text-2xl">
            {instructor?.avatar_url ? (
              <img src={instructor.avatar_url} alt={instructorName} className="h-full w-full object-cover" />
            ) : (
              instructorInitials
            )}
          </div>
          <span className="text-[10px] font-bold font-sans text-[#C8922A] uppercase tracking-widest mb-1">Penyusun Quest</span>
          <h3 className="font-heading text-[22px] font-bold text-[#2C1A08] mb-0.5">
            {instructorName}
          </h3>
          <p className="text-[13px] font-sans text-[#8B6340]">{instructorUniversity}</p>
        </div>

        {/* Description */}
        <p className="text-center max-w-2xl text-[15px] font-sans text-[#5C3D1A] leading-[1.8] mb-20">
          {session.description 
            ? session.description
            : `Uji pemahaman Anda melalui rangkaian quest interaktif tentang ${session.title}. Evaluasi penguasaan materi dalam format tantangan yang mendalam.`
          }
        </p>

        {/* Stats */}
        <div className="flex gap-16 md:gap-24 mb-24 text-center">
          <div>
            <span className="text-[10px] font-bold font-sans text-[#8B6340] uppercase tracking-widest block mb-2">Estimasi Waktu</span>
            <span className="font-heading text-[26px] font-bold text-[#C8922A]">{nodes.length > 0 ? nodes.length : 12} Sesi Quest</span>
          </div>
          <div>
            <span className="text-[10px] font-bold font-sans text-[#8B6340] uppercase tracking-widest block mb-2">Tingkat Kesulitan</span>
            <span className="font-heading text-[26px] font-bold text-[#C8922A]">Menengah</span>
          </div>
        </div>

        {/* Daftar Quest Grid */}
        <div className="w-full">
          <div className="mb-8">
            <span className="text-[11px] font-bold font-sans text-[#C8922A] uppercase tracking-widest block mb-1">Tantangan</span>
            <h2 className="font-heading text-[32px] font-bold text-[#2C1A08]">Daftar Quest</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {nodes.length > 0 ? nodes.map((node, index) => {
              const unlocked = isNodeUnlocked(node, index);
              // Different icon paths based on index to mimic the design a bit
              const icons = [
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" key="1" />,
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" key="2" />,
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" key="3" />
              ];
              const icon = icons[index % icons.length];
              const numStr = String(index + 1).padStart(2, '0');
              const score = mastery[node.id] !== undefined ? Math.round(mastery[node.id] * 100) : null;
              let grade = '';
              if (score !== null) {
                if (score >= 90) grade = 'A';
                else if (score >= 80) grade = 'B';
                else if (score >= 70) grade = 'C';
                else if (score >= 60) grade = 'D';
                else grade = 'E';
              }
              
              const override = JSON.parse(localStorage.getItem('quizOverrides') || '{}')[node.id];
              const displayTimer = override?.timer || `${Math.floor(Math.random() * 30) + 15} Mins`;
              
              return (
                <div
                  key={node.id}
                  className={`bg-white rounded-3xl p-8 border border-[#EDE4D3] shadow-sm flex flex-col transition-shadow ${unlocked ? 'hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                  onClick={() => {
                    if (unlocked) router.push(`/session/${pin}/node/${node.id}`)
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-[#FFE8D6] mb-6 flex items-center justify-center text-[#D35400]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {icon}
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold font-sans text-[#C8922A] uppercase tracking-widest block mb-2">Quest {numStr}</span>
                  <h3 className="font-heading text-[22px] font-bold text-[#2C1A08] mb-4 leading-tight">{override?.title || node.title}</h3>
                  <p className="font-sans text-[13px] text-[#5C3D1A] mb-8 leading-relaxed">
                    Tantangan eksplorasi dan pemahaman mendalam terkait materi {override?.title || node.title}.
                  </p>
                  <div className="mt-auto border-t border-[#EDE4D3] pt-5">
                    <span className="font-sans text-[13px] text-[#2C1A08] block mb-3">{node.quest_count ?? 0} Pertanyaan • {displayTimer}</span>
                    {!unlocked && (
                      <span className="bg-[#F5EFE9] text-[#8B6340] px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1.5 tracking-wide mb-3">
                        TERKUNCI • Selesaikan quest sebelumnya
                      </span>
                    )}
                    {score !== null && (
                      <div className="flex items-center gap-3">
                        <span className="bg-[#E6F4EA] text-[#137333] px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 tracking-wide">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          SELESAI
                        </span>
                        <span className="text-[#137333] font-bold text-[13px] font-sans">
                          Nilai: {grade} ({score}/100)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-3 text-center py-12">
                <p className="font-sans text-[#8B6340]">Belum ada quest di sesi ini.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}


