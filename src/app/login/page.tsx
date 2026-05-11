'use client'

import { createClient } from '../../../lib/supabase/client'
import Image from 'next/image'

export default function LoginPage() {

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    
    if (error) {
      console.error('Error logging in:', error.message)
    }
  }

  return (
    <div className="relative min-h-screen bg-warm-white flex items-center justify-center overflow-hidden">
      {/* Decorative Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[15%] -left-[10%] w-[500px] h-[500px] rounded-full bg-golden-ink/8 blur-[120px]" />
        <div className="absolute top-[30%] -right-[15%] w-[600px] h-[600px] rounded-full bg-deep-gold/5 blur-[150px]" />
        <div className="absolute -bottom-[20%] left-[15%] w-[700px] h-[700px] rounded-full bg-lontar-pale/80 blur-[100px]" />
        {/* Subtle gold ring decoration */}
        <div className="absolute top-[10%] right-[20%] w-32 h-32 rounded-full border border-golden-ink/10 animate-spin-slow" />
        <div className="absolute bottom-[15%] left-[10%] w-20 h-20 rounded-full border border-golden-ink/5 animate-spin-slow" style={{ animationDirection: 'reverse' }} />
      </div>

      {/* Lontar pattern overlay */}
      <div className="absolute inset-0 lontar-pattern pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6 py-12">
        <div className="glass-strong rounded-3xl p-10 animate-fade-in-up flex flex-col items-center text-center">
          
          {/* Logo with glow */}
          <div className="mb-8 relative">
            <div className="absolute inset-0 w-28 h-28 mx-auto rounded-full bg-golden-ink/10 blur-xl animate-pulse-gold" />
            <div className="relative w-28 h-28 mx-auto animate-float">
               <Image 
                  src="/logo.png" 
                  alt="Logo Aksara" 
                  fill 
                  className="object-contain drop-shadow-md"
                  priority
               />
            </div>
          </div>

          {/* Title */}
          <h1 className="font-heading text-4xl font-semibold text-ink-dark mb-1 tracking-tight">
            AKSARA
          </h1>
          <div className="divider-gold w-16 mx-auto !my-3" />
          <p className="font-sans text-ink-brown mb-10 leading-relaxed text-sm">
            AI Learning Copilot <br/> Perguruan Tinggi Indonesia
          </p>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            className="group w-full flex items-center justify-center gap-3 bg-white border border-sand-light text-ink-dark px-6 py-4 rounded-2xl font-medium transition-all duration-300 hover:border-golden-ink hover:shadow-gold hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              <path fill="none" d="M1 1h22v22H1z" />
            </svg>
            <span className="font-sans font-semibold">Lanjutkan dengan Google</span>
          </button>
          
          {/* Footer */}
          <div className="mt-10 flex items-center gap-2 text-xs font-sans text-warm-gray">
            <svg className="w-3.5 h-3.5 text-muted-tan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Dilindungi oleh Supabase Auth
          </div>
        </div>
      </div>
    </div>
  )
}
