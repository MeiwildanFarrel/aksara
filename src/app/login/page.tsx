'use client'

import { createClient } from '../../../lib/supabase/client'
import Image from 'next/image'
import wmIcon from '../public/wm_icon.png'

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
    <div className="relative min-h-screen bg-warm-white flex flex-col items-center justify-center overflow-hidden py-10">
      {/* Decorative Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[#FAE8B0]/40 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] rounded-full bg-[#E8B84B]/10 blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] px-6 flex flex-col items-center">

        {/* Header Outside Card */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative h-[132px] w-[220px] sm:h-[150px] sm:w-[250px]">
            <Image
              src={wmIcon}
              alt="Logo Aksara"
              fill
              className="object-contain drop-shadow-sm"
              priority
            />
          </div>
        </div>

        {/* The White Card */}
        <div className="w-full bg-white rounded-3xl p-10 border border-[#EDE4D3] shadow-[0_2px_20px_rgb(44,26,8,0.04)] text-center">
          <h1 className="font-heading text-[32px] font-bold text-[#2C1A08] mb-3">
            Selamat Datang
          </h1>
          <p className="font-sans text-[#5C3D1A] text-[15px] mb-8 leading-relaxed px-2">
            Silakan masuk untuk melanjutkan ke dashboard akademik Anda
          </p>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#C8922A] hover:bg-[#A67520] text-white px-6 py-4 rounded-full font-sans font-semibold transition-all duration-300 shadow-[0_4px_14px_rgba(200,146,42,0.25)] hover:shadow-[0_6px_20px_rgba(200,146,42,0.35)] hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                <path fill="none" d="M1 1h22v22H1z" />
              </svg>
            </div>
            Masuk dengan Google
          </button>

      
        </div>

      </div>

      {/* Footer Text */}
      <div className="absolute bottom-10 w-full text-center">
        <p className="font-sans text-[11px] font-medium tracking-[0.15em] text-[#C4A882] uppercase">
          Platform AI Untuk Perguruan Tinggi Indonesia
        </p>
      </div>
    </div>
  )
}
