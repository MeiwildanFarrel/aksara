'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '../../../../../../lib/supabase/client'
import { ChevronRight, ChevronDown, PenSquare, Share2, Play, Users, BarChart, FileText, Download, Upload, Copy, Save, CheckCircle2, Clock, MapPin, Tag, X, Eye } from 'lucide-react'
import InstructorSidebar from '../../components/InstructorSidebar'

import addCoursesIcon from '../../../../public/add_courses.png'
import analyticsIcon from '../../../../public/analytics.png'
import helpIcon from '../../../../public/help.png'
import bookIcon from '../../../../public/book.png'
import hintIcon from '../../../../public/hint.png'

interface Session {
  id: string
  title: string
  pin: string | null
  status: string | null
}

interface SkillNode {
  id: string
  title: string
  questsCount?: number
  timer?: string | null
}

interface UserData {
  id: string
  email: string
  role: string
  full_name?: string
  avatar_url?: string
  university?: string
}

export default function SessionManagement({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { id } = params

  const [user, setUser] = useState<UserData | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [nodes, setNodes] = useState<SkillNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'generating' | 'done' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const [successData, setSuccessData] = useState<{ nodes: number, quests: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({ id: '', title: '', timer: '' })

  const [isEditCourseModalOpen, setIsEditCourseModalOpen] = useState(false)
  const [courseForm, setCourseForm] = useState({ title: '', status: '' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function openEditCourse() {
    setCourseForm({ title: session?.title || '', status: session?.status || 'Draft' })
    setShowDeleteConfirm(false)
    setIsEditCourseModalOpen(true)
  }

  async function saveCourseEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!courseForm.title) return
    const supabase = createClient()
    const { error } = await supabase.from('sessions').update({ title: courseForm.title, status: courseForm.status } as any).eq('id', id)
    if (!error) {
      setIsEditCourseModalOpen(false)
      fetchData()
    }
  }

  async function deleteCourse() {
    const supabase = createClient()
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (!error) {
      router.push('/dashboard/instructor/courses')
    }
  }

  function openEditModal(node: SkillNode) {
    setEditForm({
      id: node.id,
      title: node.title,
      timer: node.timer || '30 Mins',
    })
    setIsEditModalOpen(true)
  }

  async function handleSaveNode() {
    const supabase = createClient()
    const { error } = await supabase
      .from('skill_nodes')
      .update({ title: editForm.title, timer: editForm.timer })
      .eq('id', editForm.id)

    if (!error) {
      setIsEditModalOpen(false)
      fetchNodes()
    } else {
      alert('Gagal menyimpan perubahan: ' + error.message)
    }
  }

  async function startCourse() {
    const supabase = createClient()
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'Active' } as any)
      .eq('id', id)

    if (!error) {
      fetchData()
    }
  }

  async function endSession() {
    const supabase = createClient()
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'Ended' } as any)
      .eq('id', id)

    if (!error) {
      fetchData()
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchNodes(), 3000)
    return () => clearInterval(interval)
  }, [id])

  async function fetchData() {
    setIsLoading(true)
    const supabase = createClient()

    // Fetch User
    try {
      const userRes = await fetch('/api/user/me')
      if (userRes.ok) {
        setUser(await userRes.json())
      }
    } catch (err) {
      console.error(err)
    }

    const { data: sessionData } = await supabase
      .from('sessions')
      .select('id, title, pin, status')
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
      .select('id, title, timer')
      .eq('session_id', id)
      .order('title')

    if (nodesData && nodesData.length > 0) {
      const nodeIds = nodesData.map(n => n.id)
      const { data: questsData } = await supabase
        .from('quests')
        .select('id, node_id')
        .in('node_id', nodeIds)
        .is('variant_of', null)

      const questCounts: Record<string, number> = {}
      if (questsData) {
        questsData.forEach(q => {
          if (q.node_id) questCounts[q.node_id] = (questCounts[q.node_id] || 0) + 1
        })
      }

      const enrichedNodes = nodesData.map(n => ({
        ...n,
        questsCount: questCounts[n.id] || 0
      }))
      setNodes(enrichedNodes)
    } else {
      setNodes([])
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
      <div className="flex min-h-screen items-center justify-center bg-[#FDF9F3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
          <p className="font-sans text-sm text-[#5C3D1A] animate-pulse">Memuat sesi...</p>
        </div>
      </div>
    )
  }

  const formatPin = (pin: string | null) => {
    if (!pin) return '';
    if (pin.length === 6) return `${pin.slice(0, 3)} ${pin.slice(3)}`;
    return pin;
  };

  return (
    <div className="flex h-screen bg-[#FDF9F3] text-[#2C1A08] font-sans overflow-hidden">
      <InstructorSidebar user={user} active="courses" />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto p-10">

          {/* Header */}
          <div className="flex justify-between items-start mb-10 pb-6 border-b border-[#F0E5D5]">
            <div>
              <h1 className="font-heading text-4xl font-bold text-[#2C1A08] mb-3">
                {session?.title || 'Memuat...'}
              </h1>
              <div className="flex items-center gap-2 text-sm text-[#8B6340] font-medium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B6340] mx-1"></span>
                Sesi {session?.status === 'Active' ? 'Aktif' : session?.status === 'Ended' ? 'Berakhir' : 'Draft'}
              </div>
            </div>
            <button onClick={openEditCourse} className="bg-[#C8922A] hover:bg-[#A67520] text-white px-6 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2">
              <PenSquare size={16} /> Edit Course
            </button>
          </div>

          <div className="flex gap-8">

            {/* Left Column (PIN & Upload) */}
            <div className="w-[320px] shrink-0 flex flex-col gap-6">

              {/* PIN Card */}
              <div className="bg-white rounded-3xl p-8 border border-[#F0E5D5] shadow-sm flex flex-col items-center text-center">
                <h3 className="text-[11px] font-bold text-[#8B6340] uppercase tracking-widest mb-4">PIN Akses Sesi</h3>
                <div className="font-heading text-[42px] font-bold text-[#C8922A] tracking-[0.1em] mb-4">
                  {formatPin(session?.pin ?? null)}
                </div>
                <p className="text-[#5C3D1A] text-sm mb-6 px-4">
                  Bagikan PIN ini ke mahasiswa untuk bergabung.
                </p>
                <button
                  onClick={handleCopyPin}
                  className="flex items-center justify-center gap-2 text-[#C8922A] font-bold text-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  Salin PIN
                </button>
              </div>

              {/* Upload Card */}
              <div className="bg-[#FAF6EF] rounded-3xl p-8 border border-[#F0E5D5]">
                <h3 className="font-heading text-2xl font-bold text-[#2C1A08] mb-6">Materi Sesi</h3>

                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#C4A882] rounded-2xl bg-white p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#FDF9F3] transition-colors mb-6 min-h-[160px]"
                >
                  <div className="w-12 h-12 bg-[#FDEEDB] text-[#C8922A] rounded-full flex items-center justify-center mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  </div>
                  <h4 className="font-bold text-[#2C1A08] mb-1">Upload Materi</h4>
                  <p className="text-xs text-[#8B6340] px-2 px-2">Seret PDF ke sini atau klik untuk browse</p>
                </div>

                {uploadState !== 'idle' && (
                  <div className="space-y-4 mb-8">
                    <div className={`p-4 rounded-xl border ${uploadState === 'error' ? 'bg-[#FDEDEC] border-[#C0392B]/30' : uploadState === 'done' ? 'bg-[#F2FCEE] border-[#77B28C]/50' : 'bg-[#FDF9F3] border-[#C8922A]/30'} flex items-center gap-4`}>
                      {uploadState === 'uploading' || uploadState === 'generating' ? (
                        <div className="w-6 h-6 animate-spin rounded-full border-2 border-[#C8922A] border-t-transparent shrink-0" />
                      ) : uploadState === 'done' ? (
                        <CheckCircle2 className="w-6 h-6 text-[#77B28C] shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#C0392B] text-white flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                      )}
                      <div>
                        <h4 className={`font-bold text-sm ${uploadState === 'error' ? 'text-[#C0392B]' : uploadState === 'done' ? 'text-[#2E7D32]' : 'text-[#8B6340]'}`}>
                          {uploadState === 'uploading' ? 'Sedang Mengunggah...' : uploadState === 'generating' ? 'Memproses dengan AI...' : uploadState === 'done' ? 'Berhasil!' : 'Terjadi Kesalahan'}
                        </h4>
                        <p className={`text-xs mt-0.5 leading-relaxed ${uploadState === 'error' ? 'text-[#C0392B]/80' : uploadState === 'done' ? 'text-[#2E7D32]/80' : 'text-[#8B6340]/80'}`}>
                          {uploadMessage}
                        </p>
                        {uploadState === 'done' && successData && (
                          <div className="text-xs font-semibold text-[#2E7D32] mt-1.5 flex gap-3">
                            <span>✨ {successData.nodes} Skill Nodes</span>
                            <span>🎯 {successData.quests} Quests</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {session?.status !== 'Active' && session?.status !== 'Ended' && (
                  <button onClick={startCourse} className="w-full bg-[#C8922A] hover:bg-[#A67520] text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm mt-6">
                    Start Course
                  </button>
                )}
              </div>

            </div>

            {/* Right Column (Skill Nodes) */}
            <div className="flex-1">
              <div className="bg-[#FAF6EF] rounded-3xl p-8 border border-[#F0E5D5] min-h-full">

                <div className="flex justify-between items-center mb-8">
                  <h2 className="font-heading text-2xl font-bold text-[#2C1A08]">Skill Nodes</h2>
                  <div className="bg-[#FDEEDB] text-[#C8922A] text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-[#F3D580]/50">
                    <span className="text-[10px]">✨</span> AI Generated
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {nodes.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-[#8B6340]">
                      <p>Belum ada skill node. Upload materi untuk men-generate.</p>
                    </div>
                  ) : (
                    nodes.map((node, i) => (
                      <div key={node.id} className="bg-white rounded-2xl p-6 border border-[#F0E5D5] shadow-sm flex flex-col justify-between group">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div className="bg-[#FFF0D4] w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                              {i % 2 === 0 ? (
                                <Image src={bookIcon} alt="Node" width={18} height={18} />
                              ) : (
                                <Image src={hintIcon} alt="Node" width={18} height={18} />
                              )}
                            </div>
                            <div className="flex gap-2">
                              {/* Mock prerequisite badge on some nodes for demonstration */}
                              {i > 0 && i % 2 !== 0 && (
                                <div className="bg-white border border-[#E5D5C5] text-[#8B6340] text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                  Butuh Node {i}
                                </div>
                              )}
                              <div className="bg-[#FDEEDB] text-[#C8922A] text-[10px] font-bold px-3 py-1.5 rounded-full">
                                Node {i + 1}
                              </div>
                            </div>
                          </div>

                          <h4 className="font-heading text-lg font-bold text-[#2C1A08] mb-2 leading-tight">
                            {node.title}
                          </h4>
                          <p className="text-[#8B6340] text-xs leading-relaxed line-clamp-2 mb-4">
                            Pemahaman dasar tentang konsep dan poin-penting dari materi pembelajaran ini agar dapat berlanjut ke topik berikutnya.
                          </p>
                          <div className="flex items-center gap-1.5 text-[#8B6340] text-xs mb-4">
                            <Clock size={12} className="opacity-70" /> {node.timer || '30 Mins'}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 pb-4">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#5C3D1A]">
                            <svg className="text-[#C8922A]" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                            {node.questsCount || 0} Quests
                          </div>

                          {i === 0 && (
                            <div className="flex -space-x-2">
                              <div className="w-6 h-6 rounded-full bg-[#E5D5C5] border-2 border-white flex items-center justify-center text-[8px] font-bold text-[#8B6340]">Q1</div>
                              <div className="w-6 h-6 rounded-full bg-[#E5D5C5] border-2 border-white flex items-center justify-center text-[8px] font-bold text-[#8B6340]">Q2</div>
                              <div className="w-6 h-6 rounded-full bg-[#F3D580] border-2 border-white flex items-center justify-center text-[8px] font-bold text-[#5C3D1A]">+1</div>
                            </div>
                          )}
                        </div>
                        <div className="flex mt-auto pt-4 border-t border-[#F0E5D5]">
                          <button
                            onClick={() => openEditModal(node)}
                            className="w-full bg-white border border-[#E8DCCB] text-[#5C3D1A] font-bold py-2.5 rounded-xl text-sm hover:bg-[#FAF3EC] transition-colors"
                          >
                            Edit Node
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* Edit Node Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1A08]/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-[24px] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-heading text-2xl font-bold text-[#2C1A08]">Edit Node</h2>
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="text-[#8B6340] hover:text-[#2C1A08] transition-colors p-1"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#5C3D1A] mb-1.5">Judul Node</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full px-4 py-3 bg-[#FDF9F3] border border-[#E8DCCB] rounded-xl text-[#2C1A08] font-medium focus:outline-none focus:border-[#C8922A] transition-colors"
                    />
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-[#5C3D1A] mb-1.5">Set Timer (Menit)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={editForm.timer ? editForm.timer.replace(/\D/g, '') : ''}
                          onChange={(e) => setEditForm({ ...editForm, timer: e.target.value ? `${e.target.value} Mins` : '' })}
                          className="w-full px-4 py-3 bg-[#FDF9F3] border border-[#E8DCCB] rounded-xl text-[#2C1A08] font-medium focus:outline-none focus:border-[#C8922A] transition-colors pr-10"
                        />
                        <Clock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B6340]" />
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
                        Changes made to the {editForm.title.split(' ')[0] || 'materi'} node will be synchronized across all student dashboards immediately upon saving.
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
                  onClick={handleSaveNode}
                  className="px-6 py-2.5 bg-[#C8922A] border border-[#C8922A] text-white font-bold rounded-xl hover:bg-[#A67520] transition-colors text-sm shadow-sm"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        )}

        {isEditCourseModalOpen && (
          <div className="fixed inset-0 bg-[#2C1A08]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsEditCourseModalOpen(false)}>
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading text-2xl font-bold text-[#2C1A08]">Edit Course</h3>
                <button onClick={() => setIsEditCourseModalOpen(false)} className="text-[#8B6340] hover:text-[#C0392B] transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={saveCourseEdit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-[#5C3D1A] mb-2">Judul Course</label>
                  <input
                    autoFocus
                    type="text"
                    value={courseForm.title}
                    onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                    className="w-full bg-[#FAF6EF] border border-[#E5D5C5] text-[#2C1A08] rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#C8922A]/50"
                    placeholder="Misal: Logika Formal"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#5C3D1A] mb-2">Status</label>
                  <select
                    value={courseForm.status}
                    onChange={e => setCourseForm({ ...courseForm, status: e.target.value })}
                    className="w-full bg-[#FAF6EF] border border-[#E5D5C5] text-[#2C1A08] rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#C8922A]/50"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Active">Live Now</option>
                    <option value="Ended">Ended</option>
                  </select>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <button type="submit" className="w-full bg-[#C8922A] hover:bg-[#A67520] text-white font-bold py-3.5 rounded-xl transition-colors">
                    Simpan Perubahan
                  </button>

                  {!showDeleteConfirm ? (
                    <button type="button" onClick={() => setShowDeleteConfirm(true)} className="w-full border border-[#C0392B] text-[#C0392B] font-bold py-3.5 rounded-xl hover:bg-[#C0392B]/5 transition-colors">
                      Hapus Course
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 p-4 border border-[#C0392B] bg-[#FDEDEC] rounded-xl items-center">
                      <p className="text-sm text-[#C0392B] font-semibold mb-2 text-center">Anda yakin ingin menghapus course ini?</p>
                      <div className="flex gap-2 w-full">
                        <button type="button" onClick={deleteCourse} className="flex-1 bg-[#C0392B] text-white font-bold py-2.5 rounded-lg hover:bg-[#962D22]">
                          Ya, Hapus
                        </button>
                        <button type="button" onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-white text-[#5C3D1A] font-bold py-2.5 rounded-lg border border-[#E5D5C5]">
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
