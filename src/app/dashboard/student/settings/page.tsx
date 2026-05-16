'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Save, UserCircle2 } from 'lucide-react'
import { createClient } from '../../../../../lib/supabase/client'
import StudentNav from '../components/StudentNav'

type StudentProfile = {
  id: string
  email?: string | null
  role?: string | null
  full_name?: string | null
  avatar_url?: string | null
  phone?: string | null
  nim?: string | null
  university?: string | null
  faculty?: string | null
  study_program?: string | null
  tier?: string | null
}

const profileCacheKey = 'student_profile_cache'

function readCachedProfile(): Partial<StudentProfile> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(profileCacheKey)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (name || 'ST').slice(0, 2).toUpperCase()
}

export default function StudentSettingsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<StudentProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [fullName, setFullName] = useState('')
  const [nim, setNim] = useState('')
  const [phone, setPhone] = useState('')
  const [university, setUniversity] = useState('')
  const [faculty, setFaculty] = useState('')
  const [studyProgram, setStudyProgram] = useState('')
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
      const cached = readCachedProfile()
      if (res.ok) {
        const data = await res.json()
        const merged = {
          ...cached,
          ...data,
          full_name: data.full_name || cached?.full_name || authUser.user_metadata?.full_name || '',
          avatar_url: data.avatar_url || cached?.avatar_url || '',
          nim: data.nim || cached?.nim || authUser.user_metadata?.nim || '',
          phone: data.phone || cached?.phone || authUser.user_metadata?.phone || '',
          university: data.university || cached?.university || authUser.user_metadata?.university || '',
          faculty: data.faculty || cached?.faculty || authUser.user_metadata?.faculty || '',
          study_program: data.study_program || cached?.study_program || authUser.user_metadata?.study_program || '',
        }
        setUser(merged)
        setFullName(merged.full_name || '')
        setNim(merged.nim || '')
        setPhone(merged.phone || '')
        setUniversity(merged.university || '')
        setFaculty(merged.faculty || '')
        setStudyProgram(merged.study_program || '')
        setAvatarUrl(merged.avatar_url || '')
      } else if (cached) {
        setUser(cached as StudentProfile)
        setFullName(cached.full_name || authUser.user_metadata?.full_name || '')
        setNim(cached.nim || authUser.user_metadata?.nim || '')
        setPhone(cached.phone || authUser.user_metadata?.phone || '')
        setUniversity(cached.university || authUser.user_metadata?.university || '')
        setFaculty(cached.faculty || authUser.user_metadata?.faculty || '')
        setStudyProgram(cached.study_program || authUser.user_metadata?.study_program || '')
        setAvatarUrl(cached.avatar_url || '')
      }
      setIsLoading(false)
    }

    loadUser()
  }, [router])

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
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) {
            reject(new Error('Browser tidak dapat memproses foto ini.'))
            return
          }
          canvas.width = Math.max(1, Math.round(image.width * scale))
          canvas.height = Math.max(1, Math.round(image.height * scale))
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }
        image.src = reader.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError(null)
    setSuccess(false)
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('File foto harus berupa gambar.')
    if (file.size > 5 * 1024 * 1024) return setError('Ukuran foto maksimal 5 MB.')

    try {
      const dataUrl = await resizeImageToDataUrl(file)
      if (dataUrl.length > 900_000) return setError('Foto masih terlalu besar. Gunakan foto dengan resolusi lebih kecil.')
      setAvatarUrl(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses foto.')
    }
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(false)
    if (!fullName.trim()) return setError('Full Name wajib diisi.')
    if (!nim.trim()) return setError('NIM wajib diisi.')
    if (!university.trim()) return setError('University wajib diisi.')

    setIsSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          avatar_url: avatarUrl,
          phone: phone.trim(),
          nim: nim.trim(),
          university: university.trim(),
          faculty: faculty.trim(),
          study_program: studyProgram.trim(),
          tier: user?.tier || 'Bronze Scholar',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Gagal menyimpan profil.')
      }

      const data = await res.json()
      const updatedProfile = {
        ...(user ?? {}),
        ...(data.user ?? {}),
        full_name: fullName,
        avatar_url: avatarUrl,
        nim,
        phone,
        university,
        faculty,
        study_program: studyProgram,
        tier: user?.tier || data.user?.tier || 'Bronze Scholar',
      }
      localStorage.setItem(profileCacheKey, JSON.stringify(updatedProfile))
      setUser(updatedProfile)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan profil.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0] text-[#2C1A08]">
      <StudentNav active="settings" user={user} />

      <main className="mx-auto w-full max-w-[1180px] px-4 py-8 md:px-8 md:py-10">
        {error && <div className="mb-5 rounded-xl border border-[#F1B5B1] bg-[#FCE8E6] px-5 py-3 text-sm font-semibold text-[#B32128]">{error}</div>}
        {success && <div className="mb-5 rounded-xl border border-[#B9DDC1] bg-[#EAF3EC] px-5 py-3 text-sm font-semibold text-[#196F3D]">Profil berhasil disimpan dan tersinkronisasi.</div>}

        <section className="mb-8 rounded-[22px] border border-[#E2D2C0] bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="relative shrink-0">
              <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-[#D39A2B] bg-[#F8EAD9] text-3xl font-bold text-[#8B6340] shadow-sm flex items-center justify-center">
                {avatarUrl ? <img src={avatarUrl} alt={fullName || 'Student profile'} className="h-full w-full object-cover" /> : initials(fullName || user?.email || 'ST')}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full bg-[#D39A2B] text-white border-2 border-white shadow-md flex items-center justify-center hover:bg-[#A67520]"
                aria-label="Change photo"
              >
                <Camera size={16} />
              </button>
            </div>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />

            <div className="flex-1">
              <h1 className="font-heading text-[32px] font-bold leading-tight">{fullName || 'Student Profile'}</h1>
              <p className="mt-1 text-[14px] font-semibold text-[#8B7B6B]">Undergraduate Student {university ? `• ${university}` : ''}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="rounded-[8px] bg-[#D39A2B] px-7 py-2.5 text-sm font-bold text-white hover:bg-[#A67520]">Change Photo</button>
                <button onClick={() => setAvatarUrl('')} className="rounded-[8px] border border-[#B8AEA4] bg-white px-7 py-2.5 text-sm font-bold text-[#5C5148] hover:bg-[#FAF3EC]">Remove</button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-[#E2D2C0] bg-white p-7 shadow-sm">
          <div className="mb-8 flex items-center gap-3">
            <UserCircle2 size={22} className="text-[#B58022]" />
            <h2 className="font-heading text-[25px] font-bold">Personal & Academic Information</h2>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#5C5148]">Full Name</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-[8px] border border-[#E2D2C0] bg-[#FFF1E8] px-4 py-3 text-[#2C1A08] outline-none focus:border-[#C8922A]" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#5C5148]">NIM (Nomor Induk Mahasiswa)</span>
              <input value={nim} onChange={(e) => setNim(e.target.value.replace(/[^\w.-]/g, ''))} className="w-full rounded-[8px] border border-[#E2D2C0] bg-[#FFF1E8] px-4 py-3 text-[#2C1A08] outline-none focus:border-[#C8922A]" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#5C5148]">Phone Number</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, ''))} className="w-full rounded-[8px] border border-[#E2D2C0] bg-[#FFF1E8] px-4 py-3 text-[#2C1A08] outline-none focus:border-[#C8922A]" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#5C5148]">University</span>
              <input value={university} onChange={(e) => setUniversity(e.target.value)} className="w-full rounded-[8px] border border-[#E2D2C0] bg-[#FFF1E8] px-4 py-3 text-[#2C1A08] outline-none focus:border-[#C8922A]" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#5C5148]">Faculty</span>
              <input value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder="Faculty of Computer Science" className="w-full rounded-[8px] border border-[#E2D2C0] bg-[#FFF1E8] px-4 py-3 text-[#2C1A08] outline-none focus:border-[#C8922A]" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#5C5148]">Study Program (Prodi)</span>
              <input value={studyProgram} onChange={(e) => setStudyProgram(e.target.value)} placeholder="Information Systems" className="w-full rounded-[8px] border border-[#E2D2C0] bg-[#FFF1E8] px-4 py-3 text-[#2C1A08] outline-none focus:border-[#C8922A]" />
            </label>
          </div>

          <div className="mt-14 flex flex-col gap-4 border-t border-[#E2D2C0] pt-6 md:flex-row md:items-center md:justify-between">
            <p className="max-w-[360px] text-xs italic leading-snug text-[#6F6256]">Data profil ini tersimpan di database student dan akan terbaca oleh sesi dosen yang mengampu aktivitas Anda.</p>
            <div className="flex gap-3">
              <button onClick={() => router.push('/dashboard/student')} className="rounded-[8px] border border-[#B8AEA4] bg-white px-8 py-3 text-sm font-bold text-[#5C5148] hover:bg-[#FAF3EC]">Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="inline-flex items-center gap-2 rounded-[8px] bg-[#D39A2B] px-8 py-3 text-sm font-bold text-white hover:bg-[#A67520] disabled:opacity-60">
                {isSaving ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Save size={16} />}
                Save Changes
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
