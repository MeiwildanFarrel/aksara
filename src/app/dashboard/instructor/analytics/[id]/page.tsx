'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  ChevronLeft, 
  Settings2, 
  Calendar as CalendarIcon, 
  ChevronDown,
  Settings,
  HelpCircle,
  FileText,
  Award,
  X,
  Clock,
  Eye,
  Home,
  BookOpen,
  BarChart2,
  BrainCircuit,
  LogOut
} from 'lucide-react'

interface UserData {
  id: string
  email: string
  role: string
  full_name?: string
  avatar_url?: string
  university?: string
}

export default function ManageQuizPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { id } = params
  
  const [user, setUser] = useState<UserData | null>(null)
  const [session, setSession] = useState<{title: string, pin: string | null} | null>(null)
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [stats, setStats] = useState({ totalStudents: 0, avgProgress: 0 })
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [sessionDate, setSessionDate] = useState('2024-10-24T09:00')
  const [allowLateSubmissions, setAllowLateSubmissions] = useState(true)

  // Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null)
  const [editForm, setEditForm] = useState({ title: '', timer: '', status: 'Active' })

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

      // Fetch Quizzes (skill_nodes)
      const { data: nodesData } = await supabase
        .from('skill_nodes')
        .select('id, title')
        .eq('session_id', id)
        .order('title')

      if (nodesData && nodesData.length > 0) {
        const nodeIds = nodesData.map(n => n.id)

        const heatmapRes = await fetch(`/api/dashboard/heatmap?session_id=${id}`)
        if (heatmapRes.ok) {
          const heatmap = await heatmapRes.json()
          const students = heatmap.students ?? []
          const allScores = students.flatMap((student: any) =>
            Object.values(student.scores ?? {}).filter((score): score is number => typeof score === 'number')
          )

          if (students.length > 0 || allScores.length > 0) {
            const avgScore = allScores.length > 0
              ? allScores.reduce((sum: number, score: number) => sum + score, 0) / allScores.length
              : 0
            setStats({
              totalStudents: students.length,
              avgProgress: Math.round(avgScore * 100)
            })
          }
        }

        // Fetch Stats
        const { data: masteryData } = await supabase
          .from('mastery_scores')
          .select('user_id, score')
          .in('node_id', nodeIds)

        if (masteryData && masteryData.length > 0) {
          const uniqueUsers = new Set(masteryData.map(m => m.user_id)).size
          const avgScore = masteryData.reduce((acc, curr) => acc + (curr.score || 0), 0) / masteryData.length
          setStats({
            totalStudents: uniqueUsers,
            avgProgress: Math.round(avgScore * 100)
          })
        }

        const { data: questsData } = await supabase
          .from('quests')
          .select('id, node_id')
          .in('node_id', nodeIds)
          .is('variant_of', null)

        const questCounts: Record<string, number> = {}
        if (questsData) {
          questsData.forEach(q => {
            questCounts[q.node_id] = (questCounts[q.node_id] || 0) + 1
          })
        }

        const storedOverrides = JSON.parse(localStorage.getItem('quizOverrides') || '{}')
        
        const enrichedQuizzes = nodesData.map((node, i) => {
          const override = storedOverrides[node.id] || {}
          return {
            ...node,
            title: override.title || node.title,
            questionsCount: questCounts[node.id] || 0,
            timer: override.timer || `${Math.floor(Math.random() * 30) + 15} Mins`,
            status: override.status || (i === 0 ? 'Active' : i === 1 ? 'Draft' : 'Review Required')
          }
        })
        setQuizzes(enrichedQuizzes)

        if (questsData && questsData.length > 0) {
          const questIds = questsData.map(q => q.id)
          const { data: attemptsData } = await supabase
            .from('quest_attempts')
            .select('user_id, is_correct, attempted_at')
            .in('quest_id', questIds)
            .order('attempted_at', { ascending: false })
            .limit(10)

          if (attemptsData && attemptsData.length > 0) {
            const userAttempts = attemptsData.reduce((acc: any, curr) => {
              if (!acc[curr.user_id]) acc[curr.user_id] = { correct: 0, total: 0, time: curr.attempted_at }
              acc[curr.user_id].total += 1
              if (curr.is_correct) acc[curr.user_id].correct += 1
              return acc
            }, {})

            const subs = Object.keys(userAttempts).map((uid, i) => {
              const u = userAttempts[uid]
              const mockDuration = `${Math.floor(Math.random() * 5) + 10}m ${Math.floor(Math.random() * 60)}s`
              return {
                id: uid,
                name: `Student ${uid.substring(0, 4)}`,
                initials: uid.substring(0, 2).toUpperCase(),
                quizName: enrichedQuizzes[0]?.title || 'Quiz',
                score: Math.round((u.correct / u.total) * 100),
                time: new Date(u.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                duration: mockDuration
              }
            })
            setRecentSubmissions(subs.slice(0, 3))
          }
        }
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

  const openEditModal = (quiz: any) => {
    setSelectedQuiz(quiz)
    setEditForm({
      title: quiz.title,
      timer: quiz.timer,
      status: quiz.status
    })
    setIsEditModalOpen(true)
  }

  const handleSaveQuiz = () => {
    let finalTimer = editForm.timer.trim()
    if (/^\d+$/.test(finalTimer)) {
      finalTimer = `${finalTimer} Mins`
    }

    const updatedQuiz = { ...selectedQuiz, ...editForm, timer: finalTimer }
    
    // Save to local storage for student page to read
    const storedOverrides = JSON.parse(localStorage.getItem('quizOverrides') || '{}')
    storedOverrides[updatedQuiz.id] = {
      status: updatedQuiz.status,
      timer: updatedQuiz.timer,
      title: updatedQuiz.title
    }
    localStorage.setItem('quizOverrides', JSON.stringify(storedOverrides))

    // Optimistic update
    setQuizzes(quizzes.map(q => q.id === selectedQuiz.id ? updatedQuiz : q))
    setIsEditModalOpen(false)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF9F3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
          <p className="font-sans text-sm text-[#5C3D1A] animate-pulse">Memuat manage quiz...</p>
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
            <button 
              onClick={() => router.push('/dashboard/instructor')}
              className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <Home size={18} />
              Home
            </button>
            <button 
              onClick={() => router.push('/dashboard/instructor/courses')}
              className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <BookOpen size={18} />
              Add Courses
            </button>
            <button 
              onClick={() => router.push('/dashboard/instructor/analytics')}
              className="flex items-center gap-3 w-full bg-[#F3D580] text-[#5C3D1A] rounded-xl px-4 py-3 font-semibold transition-all">
              <BarChart2 size={18} />
              Analytics
            </button>
            <button 
              onClick={() => router.push('/dashboard/instructor/cognitive')}
              className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <BrainCircuit size={18} />
              COGNITIVE
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
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        <div className="flex-1 max-w-6xl mx-auto w-full px-10 py-10">
          <button 
            onClick={() => router.push('/dashboard/instructor/analytics')}
            className="flex items-center gap-2 text-[#8B6340] hover:text-[#5C3D1A] mb-8 transition-colors font-medium text-sm"
          >
            <ChevronLeft size={16} /> Back to Analytics
          </button>

          <div className="mb-10">
            <h1 className="font-heading text-4xl font-bold text-[#2C1A08] mb-3">
              Manage Quiz: {session?.title || 'Advanced Epigraphy'}
            </h1>
            <div className="flex items-center gap-2 text-[#8B6340] text-sm">
              <span>Session ID: {session?.pin || 'EP-2024-08'}</span>
              <span className="w-1 h-1 rounded-full bg-[#8B6340]"></span>
              <span>Lecturer: {user?.full_name || 'Dosen Aksara'}</span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            
            {/* Left Column - Settings & Stats */}
            <div className="w-full lg:w-[320px] flex flex-col gap-6 shrink-0">
              
              {/* Session Settings */}
              <div className="bg-white rounded-3xl p-6 border border-[#E8DCCB] shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <Settings2 className="text-[#8B6340] w-5 h-5" />
                  <h3 className="font-heading text-xl font-bold text-[#2C1A08]">Session Settings</h3>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-[#5C3D1A] mb-2">Date & Time</label>
                    <div className="relative">
                      <input 
                        type="datetime-local" 
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        className="w-full px-4 py-3 bg-[#FAF3EC] border border-[#E8DCCB] rounded-xl text-[#2C1A08] font-medium focus:outline-none focus:border-[#C8922A] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-[#3A2411] rounded-3xl p-6 shadow-sm text-[#FDEEDB]">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#A89078] mb-6">Quick Stats</h3>
                
                <div className="space-y-6 mb-6">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-medium text-[#D9CDC1]">Total Students</span>
                    <span className="font-heading text-3xl font-bold text-[#FDEEDB]">{stats.totalStudents}</span>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-medium text-[#D9CDC1]">Average Progress</span>
                    <span className="font-heading text-3xl font-bold text-[#FDEEDB]">{stats.avgProgress}%</span>
                  </div>
                </div>

                <div className="bg-[#4A2F1D] rounded-xl p-4 border border-[#5C3D1A]">
                  <p className="text-xs italic text-[#D9CDC1] leading-relaxed">
                    Insight: Monitor the lowest completion rates to improve student engagement.
                  </p>
                </div>
              </div>
              
            </div>

            {/* Right Column - Quizzes & Submissions */}
            <div className="flex-1 flex flex-col gap-10">
              
              {/* Quiz Management */}
              <div>
                <h2 className="font-heading text-2xl font-bold text-[#2C1A08] mb-6">Quiz Management</h2>
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  
                  {quizzes.length === 0 ? (
                    <div className="col-span-full py-10 text-center text-[#8B6340] bg-white rounded-3xl border border-[#E8DCCB]">
                      Belum ada quiz/materi di sesi ini.
                    </div>
                  ) : (
                    quizzes.map((quiz, idx) => (
                      <div key={quiz.id} className="bg-white rounded-3xl p-6 border border-[#E8DCCB] shadow-sm flex flex-col hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-10 h-10 bg-[#FAF3EC] rounded-xl flex items-center justify-center text-[#C8922A]">
                            {idx % 2 === 0 ? <HelpCircle size={20} /> : <FileText size={20} />}
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide
                            ${quiz.status === 'Active' ? 'bg-[#E6F4EA] text-[#1E7E34]' : 
                              quiz.status === 'Draft' ? 'bg-[#FCE8E6] text-[#A64A31]' : 
                              quiz.status === 'Ended' ? 'bg-[#EAE4DD] text-[#8B6340]' :
                              'bg-[#FCE8E6] text-[#C0392B]'}`}
                          >
                            {quiz.status}
                          </span>
                        </div>
                        
                        <h3 className="font-heading text-xl font-bold text-[#2C1A08] mb-2 leading-tight">
                          {quiz.title}
                        </h3>
                        
                        <div className="flex items-center gap-4 text-[#8B6340] text-xs font-medium mb-6">
                          <span className="flex items-center gap-1.5"><CalendarIcon size={12}/> {quiz.timer}</span>
                          <span className="flex items-center gap-1.5"><FileText size={12}/> {quiz.questionsCount} Questions</span>
                        </div>
                        
                        <div className="flex mt-auto">
                          <button 
                            onClick={() => openEditModal(quiz)}
                            className="w-full bg-white border border-[#E8DCCB] text-[#5C3D1A] font-bold py-2.5 rounded-xl text-sm hover:bg-[#FAF3EC] transition-colors"
                          >
                            Edit Quiz
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                </div>
              </div>

              {/* Recent Submissions */}
              <div>
                <h2 className="font-heading text-2xl font-bold text-[#2C1A08] mb-6">Recent Submissions</h2>
                
                <div className="bg-white rounded-3xl border border-[#E8DCCB] shadow-sm overflow-hidden">
                  <div className="divide-y divide-[#E8DCCB]">
                    
                    {recentSubmissions.length === 0 ? (
                      <div className="p-6 text-center text-[#8B6340] text-sm">
                        Belum ada submission terbaru.
                      </div>
                    ) : (
                      recentSubmissions.map((sub, i) => (
                        <div key={i} className="p-5 flex items-center justify-between hover:bg-[#FAF3EC] transition-colors cursor-pointer">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-[#FAF3EC] text-[#8B6340] font-bold text-xs flex items-center justify-center border border-[#E8DCCB]">
                              {sub.initials}
                            </div>
                            <div>
                              <div className="font-bold text-[#2C1A08] mb-0.5">{sub.name}</div>
                              <div className="text-xs text-[#8B6340]">{sub.quizName} • {sub.time}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-heading text-lg font-bold ${sub.score >= 80 ? 'text-[#1E7E34]' : sub.score >= 60 ? 'text-[#C8922A]' : 'text-[#C0392B]'}`}>
                              {sub.score}/100
                            </div>
                            <div className="text-xs font-bold text-[#8B6340]">Time: {sub.duration}</div>
                          </div>
                        </div>
                      ))
                    )}

                  </div>
                  
                  {recentSubmissions.length > 0 && (
                    <div className="p-4 border-t border-[#E8DCCB]">
                      <button className="w-full text-center text-sm font-bold text-[#2C1A08] hover:text-[#C8922A] transition-colors">
                        View All Submissions
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Edit Quiz Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1A08]/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-[24px] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-heading text-2xl font-bold text-[#2C1A08]">Edit Item Quiz</h2>
                  <button 
                    onClick={() => setIsEditModalOpen(false)}
                    className="text-[#8B6340] hover:text-[#2C1A08] transition-colors p-1"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#5C3D1A] mb-1.5">Judul Quiz</label>
                    <input 
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                      className="w-full px-4 py-3 bg-[#FDF9F3] border border-[#E8DCCB] rounded-xl text-[#2C1A08] font-medium focus:outline-none focus:border-[#C8922A] transition-colors"
                    />
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-[#5C3D1A] mb-1.5">Set Timer</label>
                      <div className="relative">
                        <input 
                          type="text"
                          value={editForm.timer}
                          onChange={(e) => setEditForm({...editForm, timer: e.target.value})}
                          className="w-full px-4 py-3 bg-[#FDF9F3] border border-[#E8DCCB] rounded-xl text-[#2C1A08] font-medium focus:outline-none focus:border-[#C8922A] transition-colors pr-10"
                        />
                        <Clock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B6340]" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-[#5C3D1A] mb-1.5">Status</label>
                      <div className="relative">
                        <select 
                          value={editForm.status}
                          onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                          className="w-full px-4 py-3 bg-[#FDF9F3] border border-[#E8DCCB] rounded-xl text-[#2C1A08] font-medium appearance-none focus:outline-none focus:border-[#C8922A] transition-colors pr-10"
                        >
                          <option value="Active">Active</option>
                          <option value="Draft">Draft</option>
                          <option value="Review Required">Review Required</option>
                          <option value="Ended">Ended</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B6340] pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 bg-[#FDF9F3] rounded-xl p-4 border border-[#E8DCCB] flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-lg bg-[#FDEEDB] flex items-center justify-center text-[#C8922A] shrink-0">
                      <Eye size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-[#C8922A] mb-1 uppercase tracking-wider">Visual Preview</div>
                      <p className="text-[#5C3D1A] text-sm leading-relaxed">
                        Changes made to the {editForm.title.split(' ')[0] || 'module'} module will be synchronized across all student dashboards immediately upon saving.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#FDF9F3] p-6 border-t border-[#E8DCCB] flex justify-end gap-3">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-6 py-2.5 bg-white border border-[#C8922A] text-[#C8922A] font-bold rounded-xl hover:bg-[#FAF3EC] transition-colors text-sm"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveQuiz}
                  className="px-6 py-2.5 bg-[#C8922A] border border-[#C8922A] text-white font-bold rounded-xl hover:bg-[#A67520] transition-colors text-sm shadow-sm"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-[#F0E5D5] py-8 px-10 shrink-0">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
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
