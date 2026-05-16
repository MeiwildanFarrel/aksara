'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, Key, Calendar, CheckCircle2, BarChart2, BrainCircuit, Settings, Home, BookOpen, HelpCircle, LogOut } from 'lucide-react'

interface Session {
  id: string
  title: string
  pin: string | null
  created_at: string
  status?: string | null
}

interface UserData {
  id: string
  email: string
  role: string
  full_name?: string
  avatar_url?: string
  university?: string
}

export default function AnalyticsModulesPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
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
          const sessionsData = await sessionsRes.json()
          // Sort descending by created_at
          sessionsData.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          setSessions(sessionsData)
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

  const filteredSessions = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.pin && s.pin.includes(searchQuery))
  )

  const formatPin = (pin: string | null) => {
    if (!pin) return '--- ---'
    if (pin.length === 6) return `${pin.slice(0, 3)} ${pin.slice(3)}`
    return pin
  }

  const getStatusInfo = (status?: string | null) => {
    const normalized = (status || 'Draft').toLowerCase()
    if (normalized === 'active') return { status: 'Live Now', type: 'live' }
    if (normalized === 'ended') return { status: 'Session Ended', type: 'ended' }
    if (normalized === 'scheduled') return { status: 'Scheduled', type: 'scheduled' }
    return { status: 'Draft', type: 'scheduled' }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF9F3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
          <p className="font-sans text-sm text-[#5C3D1A] animate-pulse">Memuat analytics...</p>
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
              DASHBOARD
            </button>
            <button 
              onClick={() => router.push('/dashboard/instructor/courses')}
              className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <BookOpen size={18} />
              COURSES
            </button>
            <button 
              className="flex items-center gap-3 w-full bg-[#F3D580] text-[#5C3D1A] rounded-xl px-4 py-3 font-semibold transition-all">
              <BarChart2 size={18} />
              ANALYTICS
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
          <div className="mb-10">
            <h1 className="font-heading text-4xl font-bold text-[#2C1A08] mb-3">Analytics</h1>
            <p className="text-[#5C3D1A] text-lg">
              Manage your academic modules and track live participant engagement.
            </p>
          </div>

          <div className="flex gap-4 mb-10">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A89078] w-5 h-5" />
              <input
                type="text"
                placeholder="Cari materi atau PIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-[#FAF3EC] border border-[#E8DCCB] rounded-xl text-[#2C1A08] placeholder-[#A89078] focus:outline-none focus:ring-2 focus:ring-[#C8922A]/50 focus:border-[#C8922A] transition-all font-medium"
              />
            </div>
            <button className="hidden flex items-center gap-2 px-6 py-3.5 bg-[#FDEEDB] text-[#8B6340] font-semibold rounded-xl border border-[#F3D580]/50 hover:bg-[#F3D580]/30 transition-colors">
              <Filter size={18} /> Filter
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session, index) => {
              const { status, type } = getStatusInfo(session.status)
              const formattedDate = new Date(session.created_at).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })

              return (
                <div key={session.id} className="bg-white rounded-3xl p-6 border border-[#F0E5D5] shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-5">
                    {type === 'live' && (
                      <div className="bg-[#FDF3D5] text-[#A67520] text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A67520]"></span> {status}
                      </div>
                    )}
                    {type === 'scheduled' && (
                      <div className="bg-[#FAF3EC] text-[#8B6340] text-xs font-bold px-3 py-1.5 rounded-full">
                        {status}
                      </div>
                    )}
                    {type === 'ended' && (
                      <div className="bg-[#EAE4DD] text-[#8B6340] text-xs font-bold px-3 py-1.5 rounded-full">
                        {status}
                      </div>
                    )}
                    <span className="text-[10px] text-[#A89078] font-medium uppercase tracking-wider">
                      Dibuat: {formattedDate}
                    </span>
                  </div>

                  <h3 className="font-heading text-xl font-bold text-[#2C1A08] mb-3 leading-tight line-clamp-2">
                    {session.title}
                  </h3>
                  
                  <p className="text-[#8B6340] text-sm leading-relaxed mb-6 line-clamp-3 flex-1">
                    {`Sesi pembelajaran interaktif mengenai ${session.title}.`}
                  </p>

                  <div className={`rounded-xl p-4 mb-6 flex justify-between items-center ${type === 'ended' ? 'bg-[#F5EFE9]' : 'bg-[#FAF3EC]'}`}>
                    <div>
                      <div className="text-[#A89078] text-[9px] font-bold uppercase tracking-widest mb-1">Session PIN</div>
                      <div className={`font-heading text-xl font-bold tracking-widest ${type === 'ended' ? 'text-[#8B6340]/60' : 'text-[#2C1A08]'}`}>
                        {formatPin(session.pin)}
                      </div>
                    </div>
                    {type === 'live' && <Key className="text-[#C8922A] w-5 h-5" />}
                    {type === 'scheduled' && <Calendar className="text-[#8B6340] w-5 h-5" />}
                    {type === 'ended' && <CheckCircle2 className="text-[#8B6340]/60 w-5 h-5" />}
                  </div>

                  <div className="flex mt-auto">
                    <button 
                      onClick={() => router.push(`/dashboard/instructor/analytics/${session.id}/report`)}
                      className="w-full flex items-center justify-center gap-2 bg-[#C8922A] text-white font-bold py-3 rounded-xl hover:bg-[#A67520] transition-colors shadow-sm"
                    >
                      <BarChart2 size={20} />
                      Analytics
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-[#F0E5D5] py-8 px-10 shrink-0">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <div className="font-heading font-bold text-[#2C1A08] mb-1">AKSARA</div>
              <div className="text-xs text-[#8B6340]">© 2026 Aksara Learning Platform. Preserving Heritage, Empowering Future.</div>
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
