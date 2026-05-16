'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import wmIcon from '../public/wm_icon.png'

export default function OnboardingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkExistingRole()
  }, [])

  async function checkExistingRole() {
    try {
      const res = await fetch('/api/user/me')
      if (res.status === 200) {
        const data = await res.json()
        if (data.role === 'instructor') {
          router.replace('/dashboard/instructor')
        } else if (data.role === 'student') {
          router.replace('/dashboard/student')
        } else {
          setIsLoading(false)
        }
      } else {
        setIsLoading(false)
      }
    } catch {
      setIsLoading(false)
    }
  }

  async function handleRoleSelect(selectedRole: 'instructor' | 'student') {
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/user/me?role=${selectedRole}`)
      if (res.status === 201 || res.status === 200) {
        const data = await res.json().catch(() => null)
        const role = data?.role === 'instructor' || data?.role === 'student' ? data.role : selectedRole
        router.replace(`/dashboard/${role}`)
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menyimpan role')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-warm-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-[#C8922A] border-t-transparent rounded-full animate-spin"></div>
          <p className="font-sans text-sm text-[#5C3D1A] animate-pulse">Memuat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-warm-white flex flex-col items-center justify-center px-6 py-10 overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] left-[20%] w-[400px] h-[400px] rounded-full bg-[#FAE8B0]/50 blur-[100px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[#E8B84B]/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center">
        
        {/* Header Outside Card */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative h-[132px] w-[220px] sm:h-[150px] sm:w-[250px]">
            <Image
              src={wmIcon}
              alt="Aksara Logo"
              fill
              className="object-contain drop-shadow-sm"
              priority
            />
          </div>
        </div>

        {/* Main Card */}
        <div className="w-full bg-white rounded-3xl p-10 md:p-12 border border-[#EDE4D3] shadow-[0_2px_20px_rgb(44,26,8,0.04)]">

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="font-heading text-[32px] font-bold text-[#2C1A08] mb-4">Saya adalah...</h1>
            <p className="font-sans text-[#5C3D1A] text-[15px] max-w-[460px] mx-auto leading-relaxed">
              Pilih peran Anda untuk menyesuaikan pengalaman belajar dan mengajar yang lebih personal.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-center font-sans text-sm">
              {error}
            </div>
          )}

          {/* Role Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Dosen Card */}
            <button
              onClick={() => handleRoleSelect('instructor')}
              disabled={isSubmitting}
              className="group bg-white border border-[#EDE4D3] p-8 rounded-2xl flex flex-col items-center text-center transition-all duration-300 hover:border-[#C8922A] hover:shadow-[0_8px_30px_rgba(200,146,42,0.1)] hover:-translate-y-1 disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full bg-[#FAE8B0]/60 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                <svg className="w-8 h-8 text-[#A67520]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <h2 className="font-heading text-2xl font-semibold text-[#2C1A08] mb-3">Dosen</h2>
              <p className="font-sans text-[14px] text-[#5C3D1A] leading-relaxed">Kelola kelas, upload materi, pantau mahasiswa</p>
            </button>

            {/* Mahasiswa Card */}
            <button
              onClick={() => handleRoleSelect('student')}
              disabled={isSubmitting}
              className="group bg-white border border-[#EDE4D3] p-8 rounded-2xl flex flex-col items-center text-center transition-all duration-300 hover:border-[#C8922A] hover:shadow-[0_8px_30px_rgba(200,146,42,0.1)] hover:-translate-y-1 disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full bg-[#FAE8B0]/60 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                <svg className="w-8 h-8 text-[#A67520]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h2 className="font-heading text-2xl font-semibold text-[#2C1A08] mb-3">Mahasiswa</h2>
              <p className="font-sans text-[14px] text-[#5C3D1A] leading-relaxed">Belajar lewat quest, raih mastery, naikkan MMR</p>
            </button>
          </div>
   
        </div>

      </div>
    </div>
  )
}
