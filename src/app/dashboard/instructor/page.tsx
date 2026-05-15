'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '../../../../lib/supabase/client'
import { Home, BookOpen, BarChart2, BrainCircuit, Settings, HelpCircle, LogOut, Copy } from 'lucide-react'

// Import assets from src/app/public where available, or use lucide-react as fallback
import addCoursesIcon from '../../public/add_courses.png'
import analyticsIcon from '../../public/analytics.png'
import helpIcon from '../../public/help.png'
import logoutIcon from '../../public/logout.png'
import studentIcon from '../../public/student.png'
import bookIcon from '../../public/book.png'
import ratingIcon from '../../public/rating.png'

interface Session {
  id: string
  title: string
  pin: string
  instructor_id: string
  created_at: string
  status?: string | null
}

interface UserData {
  id: string
  email: string
  role: string
  full_name?: string
  avatar_url?: string
}

export default function InstructorDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ activeStudents: 0, avgRating: 4.8 })

  useEffect(() => {
    // Check if we need to open the create modal from query params
    if (typeof window !== 'undefined' && window.location.search.includes('create=true')) {
      setIsModalOpen(true)
      // Clean up URL without reloading
      const url = new URL(window.location.href)
      url.searchParams.delete('create')
      window.history.replaceState({}, '', url)
    }

    async function fetchData() {
      try {
        const [userRes, sessionsRes] = await Promise.all([
          fetch('/api/user/me'),
          fetch('/api/session/my-sessions'),
        ])

        let userData = null
        if (userRes.ok) {
          userData = await userRes.json()
          setUser(userData)

          // Jika dosen belum mengisi nama (pertama kali masuk), redirect ke halaman profile
          if (!userData?.full_name) {
            router.replace('/dashboard/instructor/settings?firsttime=1')
            return
          }
        }
        
        let userSessions = []
        if (sessionsRes.ok) {
          userSessions = await sessionsRes.json()
          setSessions(userSessions)
        }

        if (userData && userSessions.length > 0) {
          const cognitiveRes = await fetch('/api/dashboard/cognitive')
          if (cognitiveRes.ok) {
            const cognitive = await cognitiveRes.json()
            setStats(s => ({ ...s, activeStudents: cognitive.students?.length ?? 0 }))
          }
        }
      } catch (err) {
        console.error('Failed to fetch data', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return

    try {
      setIsCreating(true)
      setError(null)
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })

      if (!res.ok) throw new Error('Gagal membuat sesi')
      
      const newSession = await res.json()
      setSessions([newSession, ...sessions])
      setIsModalOpen(false)
      setNewTitle('')
      
      // Redirect ke halaman detail sesi yang baru saja dibuat
      router.push(`/dashboard/instructor/session/${newSession.id}`)
    } catch {
      setError('Terjadi kesalahan saat memBuat Course Baru.')
    } finally {
      setIsCreating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF9F3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
          <p className="font-sans text-sm text-[#5C3D1A] animate-pulse">Memuat dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white text-[#2C1A08] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[280px] bg-[#FFF8EE] border-r border-[#F0E5D5] flex flex-col justify-between">
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
            <p className="text-sm text-[#8B6340]">Senior Lecturer</p>
          </div>

          <nav className="flex flex-col gap-2">
            <button 
              onClick={() => router.push('/dashboard/instructor')}
              className="flex items-center gap-3 w-full bg-[#F3D580] text-[#5C3D1A] rounded-xl px-4 py-3 font-semibold transition-all">
              <Home size={18} />
              DASHBOARD
            </button>
            <button 
              onClick={() => router.push('/dashboard/instructor/courses')}
              className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <BookOpen size={18} />
              COURSES
            </button>
            <button 
              onClick={() => router.push('/dashboard/instructor/analytics')}
              className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <BarChart2 size={18} />
              ANALYTICS
            </button>
            <button 
              onClick={() => router.push('/dashboard/instructor/cognitive')}
              className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <BrainCircuit size={18} />
              COGNITIVE DASHBOARD
            </button>
          </nav>
        </div>

        <div className="p-8 flex flex-col gap-2">
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
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-10">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-10">
            <div>
              <h1 className="font-heading text-3xl font-bold text-[#2C1A08] flex items-center gap-2">
                Selamat datang, {user?.full_name ? user.full_name.split(' ').slice(0, 2).join(' ') : 'Dosen'} <span className="text-2xl">👋</span>
              </h1>
              <p className="mt-2 text-[#5C3D1A]">Here is the overview of your active teaching sessions and analytics.</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-[#C8922A] hover:bg-[#A67520] text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <span className="text-lg leading-none">+</span> Buat Course Baru
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-2xl p-6 border border-[#F0E5D5] shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#FFF0D4] flex items-center justify-center">
                  <Image src={studentIcon} alt="Students" width={20} height={20} />
                </div>
                <span className="font-medium text-[#5C3D1A] whitespace-nowrap">Active Students</span>
              </div>
              <div>
                <div className="font-heading text-4xl font-bold text-[#2C1A08] mb-1">{stats.activeStudents.toLocaleString()}</div>
                <div className="text-xs text-[#2E7D4F] flex items-center gap-1 font-medium">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>
                  Realtime total based on nodes
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#F0E5D5] shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#FFF0D4] flex items-center justify-center">
                  <Image src={bookIcon} alt="Sessions" width={20} height={20} />
                </div>
                <span className="font-medium text-[#5C3D1A] whitespace-nowrap">Active Sessions</span>
              </div>
              <div>
                <div className="font-heading text-4xl font-bold text-[#2C1A08] mb-1">{sessions.length}</div>
                <div className="text-xs text-[#2E7D4F] flex items-center gap-1 font-medium">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                  All sessions running smoothly
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#F0E5D5] shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#FFF0D4] flex items-center justify-center">
                  <Image src={ratingIcon} alt="Rating" width={20} height={20} />
                </div>
                <span className="font-medium text-[#5C3D1A] whitespace-nowrap">Avg. Rating</span>
              </div>
              <div>
                <div className="font-heading text-4xl font-bold text-[#2C1A08] mb-1">{stats.avgRating.toFixed(1)}</div>
                <div className="text-xs text-[#2E7D4F] flex items-center gap-1 font-medium">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>
                  +0.2 from last month
                </div>
              </div>
            </div>
          </div>

          {/* Sesi Aktif */}
          <div>
            <h2 className="font-heading text-2xl font-bold text-[#2C1A08] mb-6">Sesi Aktif</h2>
            <div className="grid grid-cols-2 gap-6">
              {sessions.map((session) => {
                const normalizedStatus = (session.status || 'Draft').toLowerCase();
                const isLive = normalizedStatus === 'active';
                const statusLabel = isLive ? 'Live Now' : normalizedStatus === 'ended' ? 'Session Ended' : normalizedStatus === 'scheduled' ? 'Scheduled' : 'Draft';
                return (
                  <div key={session.id} className="bg-white rounded-3xl p-6 border border-[#F0E5D5] shadow-sm flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      {isLive ? (
                        <span className="bg-[#FDF3D5] text-[#A67520] text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 border border-[#F3D580]/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#A67520]"></span> {statusLabel}
                        </span>
                      ) : (
                        <span className="bg-[#F8EFE4] text-[#8B6340] text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8B6340] border border-[#F0E5D5]"></span> {statusLabel}
                        </span>
                      )}
                      
                      <span className="text-xs text-[#8B6340] font-medium">
                        Dibuat: {new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    <h3 className="font-heading text-xl font-bold text-[#2C1A08] mb-3 line-clamp-2">
                      {session.title}
                    </h3>
                    <p className="text-[#5C3D1A] text-sm mb-6 flex-1 line-clamp-2 leading-relaxed">
                      Sesi interaktif untuk mahasiswa membahas materi terkait {session.title.toLowerCase()} untuk persiapan kelas.
                    </p>

                    <div className="bg-[#FAF6EF] rounded-xl p-4 border border-[#F0ECDD] mb-6 flex justify-between items-center group cursor-pointer hover:bg-[#F3EFE6] transition-colors" onClick={() => copyToClipboard(session.pin)}>
                      <div>
                        <div className="text-[#8B6340] text-[10px] font-semibold uppercase tracking-wider mb-1">Session PIN</div>
                        <div className="font-mono text-[#C8922A] font-bold text-lg tracking-widest">{session.pin}</div>
                      </div>
                      <Copy size={18} className="text-[#C4A882] group-hover:text-[#C8922A] transition-colors" />
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => router.push(`/dashboard/instructor/session/${session.id}`)}
                        className="flex-1 bg-white border border-[#C8922A] text-[#C8922A] font-semibold py-2.5 rounded-lg hover:bg-[#C8922A] hover:text-white transition-colors"
                      >
                        Kelola
                      </button>
                      <button 
                        onClick={() => router.push(`/dashboard/instructor/analytics/${session.id}/report`)}
                        className="flex-1 bg-[#C8922A] border border-[#C8922A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#A67520] transition-colors"
                      >
                        Analytics
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </main>

      {/* Create Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-[#F0E5D5]">
            <h2 className="font-heading text-2xl font-bold text-[#2C1A08] mb-2">Buat Course Baru</h2>
            <p className="text-[#5C3D1A] text-sm mb-6">Masukkan nama mata kuliah atau topik sesi ini.</p>
            
            <form onSubmit={handleCreateSession}>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Contoh: Algoritma & Pemrograman"
                className="w-full bg-[#FAF6EF] border border-[#E5D5C5] rounded-xl px-4 py-3 text-[#2C1A08] placeholder-[#C4A882] focus:outline-none focus:ring-2 focus:ring-[#C8922A] focus:border-transparent transition-all"
                autoFocus
              />
              
              {error && <p className="mt-3 text-[#C0392B] text-sm font-medium">{error}</p>}
              
              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-white border border-[#E5D5C5] text-[#5C3D1A] font-semibold py-3 rounded-xl hover:bg-[#FAF6EF] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newTitle.trim()}
                  className="flex-1 bg-[#C8922A] border border-[#C8922A] text-white font-semibold py-3 rounded-xl hover:bg-[#A67520] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Membuat...' : 'Buat Sesi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
