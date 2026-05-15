'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ChevronRight, FileText, CheckCircle, Clock, BarChart, Settings, Home, BookOpen, BarChart2, BrainCircuit, HelpCircle, LogOut, Search, Filter, Key, Calendar } from 'lucide-react'

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

function CoursesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<UserData | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState('all')
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsModalOpen(true)
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

        if (userRes.ok) {
          setUser(await userRes.json())
        }
        if (sessionsRes.ok) {
          setSessions(await sessionsRes.json())
        }
      } catch (err) {
        console.error('Failed to fetch data', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [searchParams])

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
      setIsModalOpen(false)
      setNewTitle('')
      router.push(`/dashboard/instructor/session/${newSession.id}`)
    } catch {
      setError('Terjadi kesalahan saat memBuat Course Baru.')
    } finally {
      setIsCreating(false)
    }
  }

  const formatPin = (pin: string | null) => {
    if (!pin) return '';
    if (pin.length === 6) return `${pin.slice(0,3)} ${pin.slice(3)}`;
    return pin;
  }

  const filteredSessions = sessions.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.pin && s.pin.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    
    const normalizedStatus = (s.status || 'Draft').toLowerCase();
    if (filterMode === 'live') return normalizedStatus === 'active';
    if (filterMode === 'scheduled') return normalizedStatus === 'scheduled' || normalizedStatus === 'draft';
    return true;
  }).sort((a, b) => {
    if (filterMode === 'a-z') return a.title.localeCompare(b.title);
    if (filterMode === 'z-a') return b.title.localeCompare(a.title);
    return 0;
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF9F3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
          <p className="font-sans text-sm text-[#5C3D1A] animate-pulse">Memuat courses...</p>
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
            <p className="text-sm text-[#8B6340]">Senior Lecturer</p>
          </div>

          <nav className="flex flex-col gap-2">
            <button 
              onClick={() => router.push('/dashboard/instructor')}
              className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <Home size={18} />
              DASHBOARD
            </button>
            <button className="flex items-center gap-3 w-full bg-[#F3D580] text-[#5C3D1A] rounded-xl px-4 py-3 font-semibold transition-all">
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
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto p-10">
          
          <div className="mb-8">
            <h1 className="font-heading text-4xl font-bold text-[#2C1A08] mb-2">My Courses</h1>
            <p className="text-[#5C3D1A] text-sm">{user?.full_name || 'Dosen'}</p>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search size={18} className="text-[#8B6340] opacity-60" />
              </div>
              <input 
                type="text" 
                placeholder="Cari materi atau PIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#FAF6EF] border border-[#E5D5C5] text-[#2C1A08] rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#C8922A]/50 focus:border-[#C8922A] transition-all placeholder-[#8B6340]/50"
              />
            </div>
            <div className="relative">
              <select 
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="appearance-none bg-[#FDEEDB] text-[#5C3D1A] hover:bg-[#F3D580] px-6 py-3.5 pr-10 rounded-xl font-medium flex items-center gap-2 transition-colors cursor-pointer outline-none border-none"
              >
                <option value="all">Semua Course</option>
                <option value="a-z">Nama A-Z</option>
                <option value="z-a">Nama Z-A</option>
                <option value="live">Live Now</option>
                <option value="scheduled">Scheduled / Draft</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <Filter size={18} className="text-[#5C3D1A]" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* List Sessions */}
            {filteredSessions.map((session) => {
              const normalizedStatus = (session.status || 'Draft').toLowerCase();
              const isLive = normalizedStatus === 'active';
              const statusLabel = isLive ? 'Live Now' : normalizedStatus === 'ended' ? 'Session Ended' : normalizedStatus === 'scheduled' ? 'Scheduled' : 'Draft';
              return (
                <div key={session.id} className="bg-white rounded-[24px] p-6 border border-[#E5D5C5] shadow-sm flex flex-col justify-between h-full hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-center mb-5">
                      {isLive ? (
                        <span className="bg-[#FDEEDB] text-[#5C3D1A] text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8B7500]"></span> {statusLabel}
                        </span>
                      ) : (
                        <span className="bg-[#FAF6EF] text-[#8B6340] text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                          {statusLabel}
                        </span>
                      )}
                      <span className="text-[11px] text-[#8B6340] font-medium">
                        Dibuat: {new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    <h3 className="font-heading text-2xl font-bold text-[#2C1A08] mb-3 leading-tight pr-4">
                      {session.title}
                    </h3>
                    <p className="text-[#5C3D1A] text-sm line-clamp-3 leading-relaxed opacity-90 mb-5">
                      Eksplorasi mendalam mengenai pemikiran rasionalisme dan empirisme di abad ke-17. Sesi ini dirancang untuk pemahaman dasar.
                    </p>
                  </div>

                  <div className="mt-auto">
                    <div className="bg-[#FAF6EF] rounded-xl p-4 mb-5 flex justify-between items-center">
                      <div>
                        <div className="text-[#8B6340] text-[10px] font-bold uppercase tracking-wider mb-1">Session PIN</div>
                        <div className="font-heading text-[#2C1A08] font-bold text-[22px] tracking-[0.2em]">{formatPin(session.pin)}</div>
                      </div>
                      {isLive ? (
                        <Key className="text-[#8B6340]" size={20} />
                      ) : (
                        <Calendar className="text-[#8B6340]" size={20} />
                      )}
                    </div>

                    <button 
                      onClick={() => router.push(`/dashboard/instructor/session/${session.id}`)}
                      className="w-full py-3.5 rounded-xl font-bold text-sm transition-colors bg-white border border-[#C8922A] text-[#C8922A] hover:bg-[#C8922A] hover:text-white"
                    >
                      Kelola
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Create New Session Card */}
            <div 
              onClick={() => setIsModalOpen(true)}
              className="border-2 border-dashed border-[#E5D5C5] rounded-[24px] bg-[#FAF6EF]/50 p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#FAF6EF] hover:border-[#C8922A]/50 transition-colors min-h-[350px]"
            >
              <div className="w-14 h-14 bg-[#FDEEDB] text-[#8B6340] rounded-full flex items-center justify-center mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              </div>
              <h3 className="font-heading text-[22px] font-bold text-[#2C1A08] mb-2">Materi Baru</h3>
              <p className="text-[#8B6340] text-sm leading-relaxed px-6">
                Siapkan kurikulum atau sesi interaktif berikutnya
              </p>
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

export default function CoursesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDF9F3]" />}>
      <CoursesPageContent />
    </Suspense>
  )
}
