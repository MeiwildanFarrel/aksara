'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

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
        router.replace(`/dashboard/${selectedRole}`)
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
          <div className="h-10 w-10 border-4 border-golden-ink border-t-transparent rounded-full animate-spin"></div>
          <p className="font-sans text-sm text-ink-brown animate-pulse">Memuat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-warm-white flex items-center justify-center p-6 overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] left-[20%] w-[400px] h-[400px] rounded-full bg-golden-ink/6 blur-[100px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-deep-gold/4 blur-[120px]" />
      </div>
      <div className="absolute inset-0 lontar-pattern pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl animate-fade-in-up">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 mb-5 relative animate-float">
             <Image src="/logo.png" alt="Aksara Logo" fill className="object-contain drop-shadow-md" />
          </div>
          <h1 className="font-heading text-3xl font-semibold text-ink-dark">Selamat Datang di Aksara</h1>
          <div className="divider-gold w-12 mx-auto !my-3" />
          <p className="font-sans text-ink-brown text-sm">Silakan pilih peran Anda untuk melanjutkan.</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-mastery-lemah/10 border border-mastery-lemah/20 text-mastery-lemah text-center font-sans text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Dosen Card */}
          <button
            onClick={() => handleRoleSelect('instructor')}
            disabled={isSubmitting}
            className="group glass-card p-8 rounded-3xl flex flex-col items-center text-center transition-all duration-300 hover:border-golden-ink hover:shadow-gold hover:-translate-y-1.5 disabled:opacity-50 relative overflow-hidden"
          >
            {/* Shimmer overlay */}
            <div className="absolute inset-0 shimmer" />
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-lontar-pale to-sand-light flex items-center justify-center mb-5 group-hover:from-gold-tint group-hover:to-lontar-pale transition-all duration-300 shadow-inner">
                <svg className="w-8 h-8 text-golden-ink transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="font-heading text-xl font-semibold text-ink-dark mb-2">Dosen</h2>
              <p className="font-sans text-sm text-warm-gray leading-relaxed">Buat sesi, upload materi PDF, dan pantau perkembangan mahasiswa melalui analitik kognitif.</p>
            </div>
          </button>

          {/* Mahasiswa Card */}
          <button
            onClick={() => handleRoleSelect('student')}
            disabled={isSubmitting}
            className="group glass-card p-8 rounded-3xl flex flex-col items-center text-center transition-all duration-300 hover:border-golden-ink hover:shadow-gold hover:-translate-y-1.5 disabled:opacity-50 relative overflow-hidden"
          >
            <div className="absolute inset-0 shimmer" />
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-lontar-pale to-sand-light flex items-center justify-center mb-5 group-hover:from-gold-tint group-hover:to-lontar-pale transition-all duration-300 shadow-inner">
                <svg className="w-8 h-8 text-golden-ink transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <h2 className="font-heading text-xl font-semibold text-ink-dark mb-2">Mahasiswa</h2>
              <p className="font-sans text-sm text-warm-gray leading-relaxed">Masuk dengan PIN, pelajari materi, selesaikan quest, dan pantau penguasaan materi.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
