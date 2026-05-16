'use client'

type PageLoaderProps = {
  label?: string
  fullscreen?: boolean
}

export default function PageLoader({ label = 'Memuat halaman...', fullscreen = true }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullscreen
          ? 'fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#FBF7F0]/95 backdrop-blur-sm'
          : 'flex flex-col items-center justify-center gap-4 py-20'
      }
    >
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#EDE4D3] border-t-[#C8922A]" />
      <p className="font-sans text-sm font-semibold text-[#8B6340] animate-pulse">{label}</p>
    </div>
  )
}
