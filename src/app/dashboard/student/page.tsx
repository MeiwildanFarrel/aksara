'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '../../../../lib/supabase/client'

export default function StudentDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    async function checkUser() {
      const res = await fetch('/api/user/me')
      if (res.ok) {
        setUser(await res.json())
      }
      setIsCheckingSession(false)
    }
    checkUser()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newPin = [...pin]
    newPin[index] = value
    setPin(newPin)
    setError(null)

    if (value !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && pin[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '')
    if (pastedData) {
      const newPin = [...pin]
      for (let i = 0; i < pastedData.length; i++) {
        newPin[i] = pastedData[i]
      }
      setPin(newPin)
      if (pastedData.length === 6) {
        inputRefs.current[5]?.focus()
      } else {
        inputRefs.current[pastedData.length]?.focus()
      }
    }
  }

  const handleJoinSession = async () => {
    const fullPin = pin.join('')
    if (fullPin.length !== 6) {
      setError('PIN harus 6 digit')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/session/${fullPin}`)
      if (res.ok) {
        router.push(`/session/${fullPin}`)
      } else {
        const data = await res.json()
        setError(data.error || 'Sesi tidak ditemukan')
      }
    } catch {
      setError('Terjadi kesalahan saat mengecek PIN')
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-golden-ink border-t-transparent" />
          <p className="font-sans text-sm text-ink-brown animate-pulse">Memuat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-warm-white text-ink-dark flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-sand-light bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9">
              <Image src="/logo.png" alt="Aksara" fill className="object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-lg font-bold text-ink-dark leading-tight">AKSARA</span>
              <span className="font-sans text-[10px] font-semibold text-golden-ink uppercase tracking-widest">Mahasiswa</span>
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[10%] left-[5%] w-[300px] h-[300px] rounded-full bg-golden-ink/5 blur-[80px]" />
          <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] rounded-full bg-lontar-pale/60 blur-[100px]" />
        </div>
        <div className="absolute inset-0 lontar-pattern pointer-events-none" />

        <div className="w-full max-w-md animate-scale-in text-center relative z-10">
          <div className="glass-strong rounded-3xl p-10">
            {/* Icon */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-lontar-pale to-sand-light shadow-inner-gold">
              <svg className="h-10 w-10 text-golden-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            
            <h1 className="font-heading text-2xl font-bold mb-2">Gabung Sesi</h1>
            <div className="divider-gold w-10 mx-auto !my-3" />
            <p className="font-sans text-sm text-ink-brown mb-8">Masukkan 6 digit PIN yang diberikan oleh dosen Anda.</p>
            
            {/* PIN Input */}
            <div 
              className="flex justify-center gap-2 sm:gap-3 mb-6"
              onPaste={handlePaste}
            >
              {pin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { inputRefs.current[idx] = el }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold font-mono rounded-xl bg-warm-white border-2 border-sand-light text-ink-dark focus:border-golden-ink focus:ring-2 focus:ring-gold-tint/50 outline-none transition-all duration-200 shadow-sm"
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <p className="mb-6 font-sans text-sm font-medium text-mastery-lemah animate-fade-in">{error}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleJoinSession}
              disabled={isLoading || pin.join('').length !== 6}
              className="btn-gold w-full !py-4 !text-base"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Mengecek...
                </span>
              ) : 'Masuk Kelas'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
