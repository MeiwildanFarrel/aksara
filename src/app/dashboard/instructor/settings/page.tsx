'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Home, BookOpen, BarChart2, BrainCircuit, Settings, LogOut, Camera, Trash2 } from 'lucide-react'

interface UserData {
  id: string
  email: string
  role: string
  full_name?: string
  avatar_url?: string
  university?: string
  phone?: string
  research_field?: string
}

export default function SettingsProfilePageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FDF9F3]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
      </div>
    }>
      <SettingsProfilePage />
    </Suspense>
  )
}

function SettingsProfilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isFirstTime = searchParams.get('firsttime') === '1'
  const [user, setUser] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form states
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [university, setUniversity] = useState('')
  const [phone, setPhone] = useState('')
  const [researchField, setResearchField] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.replace('/login')
        return
      }

      const res = await fetch('/api/user/me', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
        
        // Populate form
        setFullName(data.full_name || authUser.user_metadata?.full_name || '')
        setEmail(data.email || authUser.email || '')
        setUniversity(authUser.user_metadata?.university || '')
        setPhone(authUser.user_metadata?.phone || '')
        setResearchField(authUser.user_metadata?.research_field || '')
        setAvatarUrl(data.avatar_url || authUser.user_metadata?.avatar_url || '')
      }
      setIsLoading(false)
    }
    loadUser()
  }, [])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers and + sign at the beginning
    const val = e.target.value.replace(/[^\d+]/g, '')
    if (val.length <= 15) {
      setPhone(val)
    }
  }

  const resizeImageToDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()

      reader.onerror = () => reject(new Error('Gagal membaca file foto.'))
      reader.onload = () => {
        const image = new window.Image()

        image.onerror = () => reject(new Error('Format foto tidak dapat dibaca.'))
        image.onload = () => {
          const maxSize = 512
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
          const width = Math.max(1, Math.round(image.width * scale))
          const height = Math.max(1, Math.round(image.height * scale))
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')

          if (!context) {
            reject(new Error('Browser tidak dapat memproses foto ini.'))
            return
          }

          canvas.width = width
          canvas.height = height
          context.drawImage(image, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }

        image.src = reader.result as string
      }

      reader.readAsDataURL(file)
    })
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    setError(null)
    setSuccess(false)

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('File foto harus berupa gambar.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran foto maksimal 5 MB.')
      return
    }

    try {
      const dataUrl = await resizeImageToDataUrl(file)
      if (dataUrl.length > 900_000) {
        setError('Foto masih terlalu besar. Gunakan foto dengan resolusi lebih kecil.')
        return
      }
      setAvatarUrl(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses foto.')
    }
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(false)

    // Validations
    if (!fullName.trim()) return setError('Nama Lengkap wajib diisi.')
    if (!email.includes('@')) return setError('Alamat Email tidak valid.')
    if (!university.trim()) return setError('Universitas / Institusi wajib diisi.')
    
    setIsSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, avatar_url: avatarUrl, university, phone, research_field: researchField })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menyimpan profil')
      }

      const data = await res.json().catch(() => null)

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      setUser(prev => prev ? { ...prev, ...(data?.user ?? {}), full_name: fullName, avatar_url: avatarUrl } : null)
      
      // If first time, redirect to dashboard
      if (isFirstTime) {
        router.replace('/dashboard/instructor')
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan profil')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const getInitials = (name: string) => {
    if (!name) return 'DS'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF9F3]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#FDF9F3] text-[#2C1A08] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[280px] bg-[#FFF8EE] border-r border-[#F0E5D5] flex flex-col justify-between shrink-0 z-10">
        <div className="p-8">
          <div className="flex flex-col items-center mb-10">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-transparent ring-2 ring-[#C8922A]/20 bg-gray-200 mb-4 flex items-center justify-center text-xl font-bold text-[#8B6340]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="object-cover w-full h-full" />
              ) : (
                getInitials(fullName || 'Dosen')
              )}
            </div>
            <h2 className="font-heading text-xl font-bold text-[#5C3D1A] text-center">{fullName || 'Dosen'}</h2>
            <p className="text-sm text-[#8B6340]">{university || 'Akademisi'}</p>
          </div>

          <nav className="flex flex-col gap-2">
            <button onClick={() => router.push('/dashboard/instructor')} className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <Home size={18} /> DASHBOARD
            </button>
            <button onClick={() => router.push('/dashboard/instructor/courses')} className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <BookOpen size={18} /> COURSES
            </button>
            <button onClick={() => router.push('/dashboard/instructor/analytics')} className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <BarChart2 size={18} /> ANALYTICS
            </button>
            <button onClick={() => router.push('/dashboard/instructor/cognitive')} className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#8B6340] rounded-xl px-4 py-3 font-medium transition-all">
              <BrainCircuit size={18} /> COGNITIVE
            </button>
          </nav>
        </div>

        <div className="p-8 flex flex-col gap-2 border-t border-[#F0E5D5]/50">
          <button className="flex items-center gap-3 w-full bg-[#F3D580] text-[#5C3D1A] rounded-xl px-4 py-3 font-semibold transition-all">
            <Settings size={18} /> Setting Profile
          </button>
          <button onClick={handleSignOut} className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#C0392B] rounded-xl px-4 py-3 font-semibold transition-all">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto p-10 pb-20">
          
          {isFirstTime && (
            <div className="bg-[#FDF3D5] border border-[#F3D580] rounded-2xl px-6 py-4 mb-8 flex items-start gap-4">
              <div className="text-2xl">👋</div>
              <div>
                <div className="font-bold text-[#5C3D1A] mb-1">Selamat Datang di AKSARA!</div>
                <p className="text-sm text-[#8B6340]">Lengkapi profil Anda terlebih dahulu agar mahasiswa dapat mengenal Anda dengan lebih baik.</p>
              </div>
            </div>
          )}

          <div className="mb-10">
            <h1 className="font-heading text-4xl font-bold text-[#2C1A08] mb-3">Pengaturan Profil</h1>
            <p className="text-[#5C3D1A] text-lg">Kelola identitas akademik dan detail akun profesional Anda.</p>
          </div>

          {error && (
            <div className="bg-[#FCE8E6] text-[#C0392B] px-6 py-4 rounded-xl mb-6 font-medium border border-[#F5C2C7]">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-[#EAF3EC] text-[#1E7E34] px-6 py-4 rounded-xl mb-6 font-medium border border-[#C3E6CB]">
              Profil berhasil diperbarui!
            </div>
          )}

          <div className="space-y-8">
            {/* Foto Profil Card */}
            <div className="bg-white rounded-3xl p-8 border border-[#E8DCCB] shadow-sm flex flex-col md:flex-row gap-8 items-center md:items-start">
              <div className="relative shrink-0">
                <div className="w-28 h-28 rounded-2xl overflow-hidden bg-[#FAF3EC] border border-[#E8DCCB] flex items-center justify-center text-3xl font-bold text-[#C8922A]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(fullName)
                  )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-3 -right-3 w-10 h-10 bg-[#C8922A] text-white rounded-full flex items-center justify-center border-4 border-white hover:bg-[#A67520] transition-colors shadow-sm"
                >
                  <Camera size={18} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-heading text-xl font-bold text-[#2C1A08] mb-2">Foto Profil</h3>
                <p className="text-[#8B6340] text-sm mb-5">Pastikan wajah Anda terlihat jelas untuk kredibilitas akademik.</p>
                <div className="flex gap-3 justify-center md:justify-start">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-[#C8922A] text-white font-bold text-sm rounded-xl hover:bg-[#A67520] transition-colors"
                  >
                    Ganti Foto
                  </button>
                  <button 
                    onClick={() => setAvatarUrl('')}
                    className="px-5 py-2.5 bg-white text-[#5C3D1A] border border-[#E8DCCB] font-bold text-sm rounded-xl hover:bg-[#FAF3EC] transition-colors flex items-center gap-2"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>

            {/* Informasi Umum Card */}
            <div className="bg-white rounded-3xl border border-[#E8DCCB] shadow-sm overflow-hidden">
              <div className="p-8 border-b border-[#E8DCCB] flex items-center gap-3">
                <div className="bg-[#FAF3EC] text-[#C8922A] p-2 rounded-lg">
                  <BookOpen size={20} />
                </div>
                <h2 className="font-heading text-xl font-bold text-[#2C1A08]">Informasi Umum</h2>
              </div>
              
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-[#5C3D1A] mb-2">Nama Lengkap</label>
                    <input 
                      type="text" 
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Contoh: Dr. Aris Setiawan"
                      className="w-full px-4 py-3 bg-[#FAF3EC] border border-[#E8DCCB] rounded-xl text-[#2C1A08] focus:outline-none focus:border-[#C8922A] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#5C3D1A] mb-2">Alamat Email</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="aris.setiawan@ui.ac.id"
                      className="w-full px-4 py-3 bg-[#FAF3EC] border border-[#E8DCCB] rounded-xl text-[#2C1A08] focus:outline-none focus:border-[#C8922A] transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-[#5C3D1A] mb-2">Universitas / Institusi</label>
                    <input 
                      type="text" 
                      value={university}
                      onChange={e => setUniversity(e.target.value)}
                      placeholder="Universitas Indonesia"
                      className="w-full px-4 py-3 bg-[#FAF3EC] border border-[#E8DCCB] rounded-xl text-[#2C1A08] focus:outline-none focus:border-[#C8922A] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#5C3D1A] mb-2">Nomor Telepon</label>
                    <input 
                      type="text" 
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="+62 812 3456 7890"
                      className="w-full px-4 py-3 bg-[#FAF3EC] border border-[#E8DCCB] rounded-xl text-[#2C1A08] focus:outline-none focus:border-[#C8922A] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#5C3D1A] mb-2">Bidang Penelitian & Kepakaran</label>
                  <textarea 
                    value={researchField}
                    onChange={e => setResearchField(e.target.value)}
                    rows={4}
                    placeholder="Fokus pada Epistemologi Klasik dan Psikologi Kognitif..."
                    className="w-full px-4 py-3 bg-[#FAF3EC] border border-[#E8DCCB] rounded-xl text-[#2C1A08] focus:outline-none focus:border-[#C8922A] transition-colors resize-none"
                  ></textarea>
                  <div className="text-right mt-2 text-xs text-[#A89078]">Maksimum 500 kata.</div>
                </div>
              </div>

              <div className="bg-[#FAF3EC] p-6 border-t border-[#E8DCCB] flex justify-end gap-4">
                <button 
                  onClick={() => router.push('/dashboard/instructor')}
                  className="px-6 py-3 bg-transparent text-[#5C3D1A] font-bold text-sm rounded-xl hover:bg-[#E8DCCB]/50 transition-colors"
                >
                  {isFirstTime ? 'Lewati untuk saat ini' : 'Batalkan Perubahan'}
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-8 py-3 bg-[#C8922A] text-white font-bold text-sm rounded-xl hover:bg-[#A67520] transition-colors flex items-center gap-2 disabled:opacity-70"
                >
                  {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  )
}
