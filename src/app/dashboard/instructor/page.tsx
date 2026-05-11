'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '../../../../lib/supabase/client'

interface Session {
  id: string
  title: string
  pin: string
  instructor_id: string
  created_at: string
}

interface UserData {
  id: string
  email: string
  role: string
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
          setSessions(await sessionsRes.json())
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
    } catch {
      setError('Terjadi kesalahan saat membuat sesi baru.')
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-golden-ink border-t-transparent" />
          <p className="font-sans text-sm text-ink-brown animate-pulse">Memuat dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-warm-white text-ink-dark">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-sand-light bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9">
              <Image src="/logo.png" alt="Aksara" fill className="object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-lg font-bold text-ink-dark leading-tight">AKSARA</span>
              <span className="font-sans text-[10px] font-semibold text-golden-ink uppercase tracking-widest">Panel Dosen</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-sans text-ink-brown sm:block">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-xl border border-sand-light px-4 py-2 text-xs font-sans font-medium text-ink-brown hover:bg-lontar-pale hover:text-ink-dark hover:border-muted-tan transition-all duration-200"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Title Section */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="animate-fade-in-up">
            <h1 className="font-heading text-3xl font-bold text-ink-dark">Sesi Kuliah</h1>
            <p className="mt-1.5 font-sans text-sm text-ink-brown">Kelola kelas dan pantau progress mahasiswa.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-gold animate-fade-in-up"
            style={{ animationDelay: '0.1s' }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Buat Sesi Baru
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-sand-light bg-white py-20 shadow-card animate-fade-in-up lontar-pattern">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-lontar-pale shadow-inner">
              <svg className="h-10 w-10 text-warm-gray" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="font-heading text-xl font-medium text-ink-dark">Belum ada sesi</h3>
            <p className="mt-2 font-sans text-sm text-ink-brown">Buat sesi pertamamu untuk mulai mengajar.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session, index) => (
              <div 
                key={session.id} 
                className="group glass-card flex flex-col justify-between rounded-3xl p-6 transition-all duration-300 hover:border-golden-ink hover:-translate-y-1.5 hover:shadow-gold animate-fade-in-up relative overflow-hidden"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                {/* Gold accent top border */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-golden-ink via-bright-gold to-golden-ink opacity-0 group-hover:opacity-100 transition-opacity rounded-t-3xl" />
                
                <div>
                  <h3 className="font-heading text-xl font-bold text-ink-dark line-clamp-1" title={session.title}>
                    {session.title}
                  </h3>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="rounded-xl bg-lontar-pale px-4 py-2 font-mono text-lg font-bold tracking-widest text-deep-gold border border-sand-light">
                      {session.pin}
                    </div>
                    <span className="font-sans text-xs text-warm-gray font-medium">PIN Akses</span>
                  </div>
                  <p className="mt-4 font-sans text-xs text-warm-gray">
                    Dibuat: {new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => router.push(`/dashboard/instructor/session/${session.id}`)}
                    className="btn-outline flex-1 !py-2.5 !text-xs !rounded-xl"
                  >
                    Kelola
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/instructor/analytics/${session.id}`)}
                    className="flex-1 rounded-xl bg-gold-tint/40 border border-golden-ink/20 py-2.5 font-sans text-xs font-semibold text-deep-gold transition-all hover:bg-golden-ink hover:text-white hover:border-golden-ink hover:shadow-gold"
                  >
                    Analytics
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-dark/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-sand-light bg-white p-8 shadow-float animate-scale-in">
            <div className="mb-6">
              <h2 className="font-heading text-2xl font-bold text-ink-dark">Buat Sesi Baru</h2>
              <p className="mt-2 font-sans text-sm text-ink-brown">Masukkan nama mata kuliah atau topik sesi ini.</p>
            </div>
            
            <form onSubmit={handleCreateSession}>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Contoh: Algoritma & Pemrograman"
                className="input-lontar"
                autoFocus
              />
              
              {error && <p className="mt-3 font-sans text-sm text-mastery-lemah animate-fade-in">{error}</p>}
              
              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-outline flex-1"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newTitle.trim()}
                  className="btn-gold flex-1"
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
