'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '../../../../lib/supabase/client'

interface Session {
  id: string
  title: string
  pin: string
}

interface SkillNode {
  id: string
  title: string
  prerequisite_ids: string[] | null
  position_x: number | null
  position_y: number | null
}

interface MasteryMap {
  [nodeId: string]: number // score 0.0 - 1.0
}

export default function SkillTreePage({ params }: { params: { pin: string } }) {
  const router = useRouter()
  const { pin } = params
  
  const [session, setSession] = useState<Session | null>(null)
  const [nodes, setNodes] = useState<SkillNode[]>([])
  const [mastery, setMastery] = useState<MasteryMap>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTree() {
      try {
        setIsLoading(true)
        
        // 1. Fetch Session
        const sessionRes = await fetch(`/api/session/${pin}`)
        if (!sessionRes.ok) throw new Error('Sesi tidak valid')
        const sessionData: Session = await sessionRes.json()
        setSession(sessionData)

        // 2. Fetch User & Nodes & Mastery directly via Supabase
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const [nodesRes, masteryRes] = await Promise.all([
          supabase
            .from('skill_nodes')
            .select('id, title, prerequisite_ids, position_x, position_y')
            .eq('session_id', sessionData.id),
          supabase
            .from('mastery_scores')
            .select('node_id, score')
            .eq('user_id', user.id)
        ])

        if (nodesRes.error) throw nodesRes.error
        
        setNodes(nodesRes.data as SkillNode[] || [])
        
        const m: MasteryMap = {}
        if (masteryRes.data) {
          masteryRes.data.forEach(item => {
            if (item.node_id) m[item.node_id] = item.score ?? 0
          })
        }
        setMastery(m)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      } finally {
        setIsLoading(false)
      }
    }
    loadTree()
  }, [pin])

  // Helper functions
  const getNodeStatus = (nodeId: string) => {
    const score = mastery[nodeId]
    if (score === undefined) return 'untested'
    if (score > 0.8) return 'dikuasai'
    if (score >= 0.4) return 'aktif'
    return 'lemah'
  }

  const isNodeLocked = (node: SkillNode) => {
    if (!node.prerequisite_ids || node.prerequisite_ids.length === 0) return false
    
    // Harus menguasai SEMUA prerequisites (> 0.8)
    return !node.prerequisite_ids.every(preId => {
      const s = mastery[preId]
      return s !== undefined && s > 0.8
    })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-warm-white">
        <div className="relative">
          <div className="h-16 w-16 animate-spin-slow rounded-full border-2 border-sand-light border-t-golden-ink" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-golden-ink/10 animate-pulse" />
          </div>
        </div>
        <p className="mt-6 font-sans text-sm text-ink-brown animate-pulse">Menghubungkan jaringan neural...</p>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white p-6">
        <div className="rounded-3xl border border-mastery-lemah/20 bg-white p-10 text-center max-w-md shadow-float animate-scale-in">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-mastery-lemah/10">
            <svg className="h-8 w-8 text-mastery-lemah" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="font-heading text-2xl font-bold text-ink-dark mb-2">Gagal Memuat Skill Tree</h2>
          <p className="font-sans text-sm text-mastery-lemah mb-8">{error}</p>
          <button onClick={() => router.push('/dashboard/student')} className="btn-outline">
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-warm-white text-ink-dark">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-sand-light bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard/student')} className="rounded-xl p-2.5 text-ink-brown hover:bg-lontar-pale hover:text-ink-dark transition-all">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-8 hidden sm:block">
                <Image src="/logo.png" alt="Aksara Logo" fill className="object-contain" />
              </div>
              <div>
                <h1 className="font-heading text-lg font-bold text-ink-dark leading-tight">{session.title}</h1>
                <p className="font-sans text-[10px] font-semibold text-golden-ink uppercase tracking-widest">Skill Tree</p>
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-4 font-sans text-xs font-semibold">
            <div className="badge-dikuasai">
              <div className="h-2.5 w-2.5 rounded-full bg-mastery-dikuasai" /> Dikuasai
            </div>
            <div className="badge-aktif">
              <div className="h-2.5 w-2.5 rounded-full bg-mastery-aktif" /> Aktif
            </div>
            <div className="badge-lemah">
              <div className="h-2.5 w-2.5 rounded-full bg-mastery-lemah" /> Lemah
            </div>
            <div className="badge-terkunci">
              <div className="h-2.5 w-2.5 rounded-full bg-mastery-terkunci" /> Terkunci
            </div>
          </div>
        </div>
      </header>

      {/* Grid Based Skill Tree */}
      <main className="mx-auto max-w-7xl p-6 md:p-12">
        {nodes.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center lontar-pattern rounded-3xl">
            <div className="mb-6 relative h-24 w-24 opacity-40 grayscale animate-float">
              <Image src="/logo.png" alt="Logo" fill className="object-contain" />
            </div>
            <h2 className="font-heading text-3xl font-bold text-ink-dark">Belum ada nodes.</h2>
            <p className="mt-3 font-sans text-sm text-ink-brown">Dosen belum mengupload materi untuk sesi ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {nodes.map((node, idx) => {
              const isLocked = isNodeLocked(node)
              const status = getNodeStatus(node.id)
              
              let borderColor = 'border-sand-light'
              let bgStyle = 'bg-white'
              let textColor = 'text-ink-dark'
              let statusText = 'Belum dicoba'
              let statusBadgeClass = 'badge-aktif'
              let iconColor = 'text-golden-ink'
              let icon = <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /> // default icon
              
              if (isLocked) {
                borderColor = 'border-muted-tan/40'
                bgStyle = 'bg-lontar-pale/70'
                textColor = 'text-warm-gray'
                statusText = 'Terkunci'
                statusBadgeClass = 'badge-terkunci'
                iconColor = 'text-warm-gray'
                icon = <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></> // lock
              } else if (status === 'dikuasai') {
                borderColor = 'border-mastery-dikuasai/50'
                bgStyle = 'bg-mastery-dikuasai/5'
                statusText = 'Dikuasai'
                statusBadgeClass = 'badge-dikuasai'
                iconColor = 'text-mastery-dikuasai'
                icon = <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" /> // check
              } else if (status === 'aktif') {
                borderColor = 'border-mastery-aktif/50'
                bgStyle = 'bg-mastery-aktif/5'
                statusText = 'Aktif'
                statusBadgeClass = 'badge-aktif'
                iconColor = 'text-mastery-aktif'
                icon = <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              } else if (status === 'lemah') {
                borderColor = 'border-mastery-lemah/50'
                bgStyle = 'bg-mastery-lemah/5'
                statusText = 'Perlu perbaikan'
                statusBadgeClass = 'badge-lemah'
                iconColor = 'text-mastery-lemah'
                icon = <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" /> // warning
              }

              return (
                <button
                  key={node.id}
                  onClick={() => !isLocked && router.push(`/session/${pin}/node/${node.id}`)}
                  disabled={isLocked}
                  className={`group relative flex flex-col items-center justify-center rounded-3xl border-2 p-8 transition-all duration-300 animate-fade-in-up
                    ${borderColor} ${bgStyle} 
                    ${!isLocked ? 'hover:-translate-y-2 hover:shadow-gold active:scale-[0.98] cursor-pointer' : 'cursor-not-allowed opacity-75'}
                  `}
                  style={{ animationDelay: `${idx * 0.06}s` }}
                >
                  {/* Hover glow */}
                  {!isLocked && (
                    <div className="absolute inset-0 rounded-3xl bg-golden-ink/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                  
                  <div className={`relative z-10 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border ${borderColor} bg-white shadow-sm group-hover:shadow-md transition-shadow`}>
                    <svg className={`h-8 w-8 ${iconColor} transition-transform group-hover:scale-110`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {icon}
                    </svg>
                  </div>
                  
                  <h3 className={`relative z-10 font-heading text-center font-bold text-lg leading-snug line-clamp-2 min-h-[56px] flex items-center ${textColor}`}>
                    {node.title}
                  </h3>
                  
                  <div className={`relative z-10 mt-5 ${statusBadgeClass}`}>
                    {statusText}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
