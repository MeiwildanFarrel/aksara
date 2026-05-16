'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  ChevronLeft, 
  Home, 
  BookOpen, 
  BarChart2, 
  BrainCircuit,
  Settings,
  HelpCircle, 
  LogOut,
  Filter,
  ChevronRight
} from 'lucide-react'

interface UserData {
  id: string
  full_name?: string
  avatar_url?: string
  university?: string
}

export default function AnalyticsReportPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { id } = params
  
  const [user, setUser] = useState<UserData | null>(null)
  const [session, setSession] = useState<{title: string, pin: string | null} | null>(null)
  const [nodes, setNodes] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Filter States
  const [filterType, setFilterType] = useState<'mmr_desc'|'name_asc'|'name_desc'>('mmr_desc')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      
      // Fetch User
      const userRes = await fetch('/api/user/me')
      if (userRes.ok) {
        setUser(await userRes.json())
      }

      // Fetch Session
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('title, pin')
        .eq('id', id)
        .single()
        
      if (sessionData) setSession(sessionData)

      const heatmapRes = await fetch(`/api/dashboard/heatmap?session_id=${id}`)
      if (heatmapRes.ok) {
        const heatmap = await heatmapRes.json()
        const heatmapNodes = heatmap.nodes ?? []
        const heatmapStudents = heatmap.students ?? []

        setNodes(heatmapNodes.map((node: any) => {
          const scores = heatmapStudents
            .map((student: any) => student.scores?.[node.id])
            .filter((score: unknown): score is number => typeof score === 'number')

          const mastery = scores.length > 0
            ? Math.round((scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length) * 100)
            : 0

          return { ...node, mastery }
        }))

        setStudents(heatmapStudents.map((student: any) => {
          const scores = Object.values(student.scores ?? {}).filter((score): score is number => typeof score === 'number')
          const avgScore = scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : 0
          const mmr = Math.max(0, Math.round(avgScore * 2900))
          let computedTier = 'Bronze Scholar'
          if (mmr >= 2800) computedTier = 'Diamond Scholar'
          else if (mmr >= 2400) computedTier = 'Platinum Scholar'
          else if (mmr >= 1800) computedTier = 'Gold Scholar'
          else if (mmr >= 1500) computedTier = 'Silver Scholar'

          return {
            id: student.user_id,
            name: student.name || student.email?.split('@')[0] || `Student ${student.user_id.slice(0, 4)}`,
            nim: student.nim || '-',
            tier: student.tier || computedTier,
            mmr,
            badges: avgScore >= 0.8 ? ['Mastery Pro'] : avgScore >= 0.5 ? ['Progressing'] : [],
          }
        }))
      } else {
        setNodes([])
        setStudents([])
      }
      
      setIsLoading(false)
    }
    fetchData()
  }, [id])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Sorting
  const sortedStudents = [...students].sort((a, b) => {
    if (filterType === 'mmr_desc') return b.mmr - a.mmr
    if (filterType === 'name_asc') return a.name.localeCompare(b.name)
    if (filterType === 'name_desc') return b.name.localeCompare(a.name)
    return 0
  })

  const totalPages = Math.max(1, Math.ceil(sortedStudents.length / itemsPerPage))
  const paginatedStudents = sortedStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const overallMastery = nodes.length > 0 
    ? Math.round(nodes.reduce((acc, n) => acc + n.mastery, 0) / nodes.length) 
    : 0

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF9F3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
          <p className="font-sans text-sm text-[#5C3D1A] animate-pulse">Memuat report...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#FDF9F3] text-[#2C1A08] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[280px] bg-[#FFF8EE] border-r border-[#F0E5D5] flex flex-col justify-between shrink-0 z-10">
        <div className="p-8">
          <div className="flex flex-col items-center mb-10">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-transparent ring-2 ring-[#C8922A]/20 bg-[#FAF3EC] mb-4 flex items-center justify-center text-2xl font-bold text-[#8B6340]">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Profile" className="object-cover w-full h-full" />
              ) : (
                (user?.full_name || 'DS').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
              )}
            </div>
            <h2 className="font-heading text-xl font-bold text-[#5C3D1A] text-center">{user?.full_name || 'Dosen'}</h2>
            <p className="text-sm text-[#8B6340]">{user?.university || 'Akademisi'}</p>
          </div>

          <nav className="flex flex-col gap-2">
            <button onClick={() => router.push('/dashboard/instructor')} className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <Home size={18} /> DASHBOARD
            </button>
            <button onClick={() => router.push('/dashboard/instructor/courses')} className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <BookOpen size={18} /> COURSES
            </button>
            <button onClick={() => router.push('/dashboard/instructor/analytics')} className="flex items-center gap-3 w-full bg-[#F3D580] text-[#5C3D1A] rounded-xl px-4 py-3 font-semibold transition-all">
              <BarChart2 size={18} /> ANALYTICS
            </button>
            <button onClick={() => router.push('/dashboard/instructor/cognitive')} className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <BrainCircuit size={18} /> COGNITIVE
            </button>
          </nav>
        </div>

        <div className="p-8 flex flex-col gap-2 border-t border-[#F0E5D5]/50">
          <button 
            onClick={() => router.push('/dashboard/instructor/settings')}
            className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all"
          >
            <Settings size={18} /> 
            Setting Profile
          </button>
          <button onClick={handleSignOut} className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#C0392B] rounded-xl px-4 py-3 font-semibold transition-all">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        <div className="flex-1 max-w-5xl mx-auto w-full px-10 py-10">
          <button 
            onClick={() => router.push(`/dashboard/instructor/analytics`)}
            className="flex items-center gap-2 text-[#8B6340] hover:text-[#5C3D1A] mb-6 transition-colors font-medium text-sm"
          >
            <ChevronLeft size={16} /> Back to Analytics
          </button>

          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-[#F3D580] text-[#5C3D1A] text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                COURSE ID: {session?.pin || 'PHIL-202'}
              </span>
              <span className="text-[#8B6340] font-semibold text-sm">
                Epistemology & Rational Thought
              </span>
            </div>
            <h1 className="font-heading text-5xl font-bold text-[#2C1A08] mb-4">
              {session?.title || 'The Architecture of Logic'}
            </h1>
            <p className="text-[#5C3D1A] text-lg max-w-3xl leading-relaxed">
              A detailed analysis of material performance, cognitive mastery trends, and individual student progress across theoretical foundations.
            </p>
          </div>

          {/* Mastery Overview */}
          <div className="bg-white rounded-[24px] p-8 border border-[#E8DCCB] mb-8 shadow-sm">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h2 className="font-heading text-2xl font-bold text-[#2C1A08] mb-1">Mastery Overview</h2>
                <p className="text-[#8B6340] text-sm">Aggregate cohort proficiency in logic gates & syllogisms</p>
              </div>
              <div className="text-right">
                <div className="font-heading text-5xl font-bold text-[#C8922A] leading-none mb-1">
                  {overallMastery}%
                </div>
                {nodes.length > 0 && (
                  <div className="text-[#1E7E34] text-xs font-bold flex items-center gap-1 justify-end">
                    ↑ Data from {students.length} students
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {nodes.length === 0 ? (
                <div className="text-[#8B6340] italic text-sm">No data available for this session. Students haven't completed quests.</div>
              ) : nodes.map((node, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm font-bold text-[#5C3D1A] mb-2">
                    <span>{node.title}</span>
                    <span>{node.mastery}% Mastery</span>
                  </div>
                  <div className="h-3.5 bg-[#FAF3EC] rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-[#C8922A] transition-all duration-1000 ease-out rounded-full" 
                      style={{ width: `${node.mastery}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Student Performance Ledger */}
          <div className="bg-white rounded-[24px] border border-[#E8DCCB] shadow-sm overflow-hidden mb-8">
            <div className="p-8 border-b border-[#E8DCCB] flex justify-between items-center bg-white relative">
              <h2 className="font-heading text-2xl font-bold text-[#2C1A08]">Student Performance Ledger</h2>
              
              <div className="relative">
                <button 
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FAF3EC] text-[#5C3D1A] font-bold text-sm rounded-xl hover:bg-[#F3D580]/30 transition-colors border border-[#E8DCCB]"
                >
                  <Filter size={16} /> Filter
                </button>
                {showFilterDropdown && (
                  <div className="absolute right-0 top-12 w-48 bg-white border border-[#E8DCCB] rounded-xl shadow-lg z-20 py-2">
                    <button onClick={() => { setFilterType('mmr_desc'); setShowFilterDropdown(false); setCurrentPage(1); }} className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-[#FAF3EC] ${filterType === 'mmr_desc' ? 'text-[#C8922A]' : 'text-[#5C3D1A]'}`}>Tertinggi MMR (Z-A)</button>
                    <button onClick={() => { setFilterType('name_asc'); setShowFilterDropdown(false); setCurrentPage(1); }} className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-[#FAF3EC] ${filterType === 'name_asc' ? 'text-[#C8922A]' : 'text-[#5C3D1A]'}`}>Nama Siswa (A-Z)</button>
                    <button onClick={() => { setFilterType('name_desc'); setShowFilterDropdown(false); setCurrentPage(1); }} className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-[#FAF3EC] ${filterType === 'name_desc' ? 'text-[#C8922A]' : 'text-[#5C3D1A]'}`}>Nama Siswa (Z-A)</button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white text-xs font-bold text-[#8B6340] uppercase tracking-wider border-b border-[#E8DCCB]">
                    <th className="px-8 py-5 font-bold">Student Name</th>
                    <th className="px-6 py-5 font-bold">NIM</th>
                    <th className="px-6 py-5 font-bold">Academic Tier</th>
                    <th className="px-6 py-5 font-bold">MMR Score</th>
                    <th className="px-8 py-5 font-bold">Mastery Badges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DCCB] bg-white">
                  {paginatedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-10 text-center text-[#8B6340] italic">
                        Belum ada siswa yang mengerjakan materi ini.
                      </td>
                    </tr>
                  ) : paginatedStudents.map((student, idx) => (
                    <tr key={idx} className="hover:bg-[#FDF9F3] transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1A2530] flex items-center justify-center shrink-0 overflow-hidden">
                            <span className="text-white text-xs font-bold">{student.name.substring(0, 2).toUpperCase()}</span>
                          </div>
                          <span className="font-bold text-[#2C1A08]">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-[#5C3D1A]">{student.nim}</td>
                      <td className="px-6 py-5">
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap
                          ${student.tier.includes('Platinum') ? 'bg-[#FDEEDB] text-[#A67520]' : 
                            student.tier.includes('Gold') ? 'bg-[#FCE8E6] text-[#A64A31]' : 
                            'bg-[#EAE4DD] text-[#8B6340]'}`}
                        >
                          {student.tier}
                        </span>
                      </td>
                      <td className="px-6 py-5 font-bold text-[#2C1A08] text-lg">
                        {student.mmr.toLocaleString()}
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-wrap gap-2">
                          {student.badges.map((badge: string, bidx: number) => {
                            const isGreen = badge.includes('Logic') || bidx % 2 !== 0
                            return (
                              <span key={bidx} className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap text-white
                                ${isGreen ? 'bg-[#4A8B63]' : 'bg-[#A67520]'}`}
                              >
                                {badge}
                              </span>
                            )
                          })}
                          {student.badges.length === 0 && (
                            <span className="text-xs text-[#A89078] italic">No Badges</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-white border-t border-[#E8DCCB] flex justify-center items-center gap-6">
              <button 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="text-[#A89078] hover:text-[#2C1A08] transition-colors disabled:opacity-50"
              ><ChevronLeft size={18} /></button>
              <span className="text-sm font-bold text-[#2C1A08]">Page {currentPage} of {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="text-[#A89078] hover:text-[#2C1A08] transition-colors disabled:opacity-50"
              ><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-[#F0E5D5] py-8 px-10 shrink-0 mt-auto bg-[#FDF9F3]">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <div className="font-heading font-bold text-[#2C1A08] mb-1">AKSARA</div>
              <div className="text-xs text-[#8B6340]">© 2024 Aksara Learning Platform. Preserving Heritage, Empowering Future.</div>
            </div>
            <div className="flex gap-6 text-xs text-[#8B6340] font-medium">
              <a href="#" className="hover:text-[#C8922A] transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-[#C8922A] transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-[#C8922A] transition-colors">University Partners</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
