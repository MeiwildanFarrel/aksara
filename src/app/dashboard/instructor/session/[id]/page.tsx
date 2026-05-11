'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../../../lib/supabase/client'

interface Session {
  id: string
  title: string
  pin: string | null
}

interface SkillNode {
  id: string
  title: string
}

export default function SessionManagement({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { id } = params
  
  const [session, setSession] = useState<Session | null>(null)
  const [nodes, setNodes] = useState<SkillNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploadState, setUploadState] = useState<'idle'|'uploading'|'generating'|'done'|'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const [successData, setSuccessData] = useState<{nodes: number, quests: number} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchNodes(), 3000)
    return () => clearInterval(interval)
  }, [id])

  async function fetchData() {
    setIsLoading(true)
    const supabase = createClient()
    
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('id, title, pin')
      .eq('id', id)
      .single()
      
    if (sessionData) {
      setSession(sessionData)
    }
    
    await fetchNodes()
    setIsLoading(false)
  }

  async function fetchNodes() {
    const supabase = createClient()
    const { data: nodesData } = await supabase
      .from('skill_nodes')
      .select('id, title')
      .eq('session_id', id)
      .order('title')
      
    if (nodesData) {
      setNodes(nodesData)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadState('uploading')
      setUploadMessage('Mengekstrak teks PDF...')
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('session_id', id)

      // Step 1: Upload PDF
      const uploadRes = await fetch('/api/upload/pdf', {
        method: 'POST',
        body: formData,
      })
      
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Gagal upload PDF')
      }

      // Step 2: Generate Nodes & Quests
      setUploadState('generating')
      setUploadMessage('Membuat Skill Tree & Quest dengan AI... (estimasi 20-40 detik)')

      const generateRes = await fetch('/api/quest/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id }),
      })
      
      const generateData = await generateRes.json()
      if (!generateRes.ok) {
        throw new Error(generateData.error || 'Gagal membuat Skill Tree & Quest')
      }
      
      setUploadState('done')
      setSuccessData({
        nodes: generateData.nodes_created || generateData.nodes || 0,
        quests: generateData.quests_created || generateData.quests || 0
      })
      
      fetchNodes()
    } catch (err) {
      setUploadState('error')
      setUploadMessage(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleCopyPin() {
    if (session?.pin) {
      navigator.clipboard.writeText(session.pin)
      alert('PIN disalin ke clipboard!')
    }
  }

  if (isLoading && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-golden-ink border-t-transparent" />
          <p className="font-sans text-sm text-ink-brown animate-pulse">Memuat sesi...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-warm-white text-ink-dark">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-sand-light bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <button
            onClick={() => router.push('/dashboard/instructor')}
            className="rounded-xl p-2.5 text-ink-brown hover:bg-lontar-pale hover:text-ink-dark transition-all"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex flex-col">
            <span className="font-sans text-xs font-semibold text-golden-ink uppercase tracking-widest">Kelola Sesi</span>
            <span className="font-heading text-xl font-bold">{session?.title}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          
          {/* Left Column: Info & Upload */}
          <div className="space-y-6 md:col-span-1">
            {/* PIN Card */}
            <div className="glass-card rounded-3xl p-6 text-center animate-fade-in-up relative overflow-hidden">
              <div className="absolute inset-0 lontar-pattern" />
              <div className="relative z-10">
                <h3 className="font-sans text-xs font-semibold text-golden-ink uppercase tracking-widest mb-4">PIN Sesi</h3>
                <div className="my-4 flex items-center justify-center">
                  <span className="font-mono text-4xl font-extrabold tracking-[0.3em] text-deep-gold">
                    {session?.pin}
                  </span>
                </div>
                <button
                  onClick={handleCopyPin}
                  className="btn-outline w-full !text-xs"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Salin PIN
                </button>
              </div>
            </div>

            {/* Upload Card */}
            <div className="glass-card rounded-3xl p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <h3 className="font-heading mb-1 text-xl font-bold">Materi Kuliah</h3>
              <div className="divider-gold w-8 !my-3" />
              <p className="font-sans mb-6 text-sm text-ink-brown leading-relaxed">
                Upload modul/buku berformat PDF. Sistem akan memproses materi menjadi Skill Tree dan Quests secara otomatis.
              </p>
              
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadState === 'uploading' || uploadState === 'generating'}
                className="btn-gold w-full"
              >
                {(uploadState === 'uploading' || uploadState === 'generating') ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                    </svg>
                    {uploadState === 'uploading' ? 'Mengekstrak PDF...' : 'Memproses AI...'}
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    Upload PDF Materi
                  </>
                )}
              </button>

              {/* Progress Indicator */}
              {uploadState !== 'idle' && (
                <div className={`mt-4 rounded-xl border p-4 font-sans text-sm animate-fade-in
                  ${uploadState === 'error' ? 'border-mastery-lemah/20 bg-mastery-lemah/10 text-mastery-lemah' : 
                    uploadState === 'done' ? 'border-mastery-dikuasai/20 bg-mastery-dikuasai/10 text-mastery-dikuasai' : 
                    'border-golden-ink/20 bg-gold-tint/10 text-golden-ink'}`}>
                  {uploadState === 'error' && <span>❌ {uploadMessage}</span>}
                  {(uploadState === 'uploading' || uploadState === 'generating') && (
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 shrink-0 animate-ping rounded-full bg-golden-ink" />
                      <span>{uploadMessage}</span>
                    </div>
                  )}
                  {uploadState === 'done' && successData && (
                    <span>✅ Selesai! {successData.nodes} nodes dan {successData.quests} quests berhasil dibuat.</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Nodes List */}
          <div className="md:col-span-2 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <div className="glass-card rounded-3xl p-6 min-h-[500px]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-2xl font-bold">Skill Nodes</h3>
                  <p className="font-sans text-xs text-warm-gray mt-1">{nodes.length} topik</p>
                </div>
                <div className="badge-dikuasai flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mastery-dikuasai opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-mastery-dikuasai"></span>
                  </span>
                  Live Sync
                </div>
              </div>

              {nodes.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center lontar-pattern rounded-2xl">
                  <div className="mb-4 rounded-2xl bg-lontar-pale p-5 shadow-inner">
                    <svg className="h-10 w-10 text-warm-gray" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                  <p className="font-sans text-ink-brown text-sm">Belum ada skill node.<br/>Upload PDF materi untuk mulai men-generate nodes.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {nodes.map((node, idx) => (
                    <div 
                      key={node.id} 
                      className="group flex items-start gap-4 rounded-2xl border border-sand-light bg-white p-4 transition-all duration-200 hover:bg-lontar-pale hover:border-golden-ink/30 hover:shadow-sm animate-fade-in-up"
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-tint to-lontar-pale text-deep-gold shadow-sm group-hover:from-golden-ink group-hover:to-deep-gold group-hover:text-white transition-all duration-200">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-sans font-bold text-ink-dark text-sm leading-snug">{node.title}</h4>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
