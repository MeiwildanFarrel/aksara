'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { BarChart2, BookOpen, BrainCircuit, Home, LogOut, Settings, X } from 'lucide-react'
import { createClient } from '../../../../../lib/supabase/client'

interface UserData {
  full_name?: string
  avatar_url?: string
  university?: string
}

type ActivePage = 'dashboard' | 'courses' | 'analytics' | 'cognitive' | 'settings'

interface Props {
  user: UserData | null
  active: ActivePage
}

const NAV_ITEMS: Array<{ key: ActivePage; href: string; label: string; icon: React.ReactNode }> = [
  { key: 'dashboard', href: '/dashboard/instructor', label: 'DASHBOARD', icon: <Home size={18} /> },
  { key: 'courses', href: '/dashboard/instructor/courses', label: 'COURSES', icon: <BookOpen size={18} /> },
  { key: 'analytics', href: '/dashboard/instructor/analytics', label: 'ANALYTICS', icon: <BarChart2 size={18} /> },
  { key: 'cognitive', href: '/dashboard/instructor/cognitive', label: 'COGNITIVE', icon: <BrainCircuit size={18} /> },
]

export default function InstructorSidebar({ user, active }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const avatarInitials = (user?.full_name || 'DS')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  const sidebarContent = (
    <aside className="h-screen flex flex-col bg-[#FFF8EE] border-r border-[#F0E5D5] w-[280px]">
      {/* Close button — mobile only */}
      <div className="flex items-center justify-between p-4 md:hidden border-b border-[#F0E5D5]">
        <span className="font-heading text-base font-bold text-[#2C1A08]">Menu</span>
        <button
          onClick={() => setIsOpen(false)}
          className="p-2 rounded-lg hover:bg-[#F5EFE9] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Tutup menu"
        >
          <X size={20} className="text-[#5C3D1A]" />
        </button>
      </div>

      {/* Profile section */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-transparent ring-2 ring-[#C8922A]/20 bg-[#FAF3EC] mb-4 flex items-center justify-center text-2xl font-bold text-[#8B6340]">
            {user?.avatar_url ? (
              <Image src={user.avatar_url} alt="Profile" fill className="object-cover" unoptimized />
            ) : (
              avatarInitials
            )}
          </div>
          <h2 className="font-heading text-xl font-bold text-[#5C3D1A] text-center">
            {user?.full_name || 'Dosen'}
          </h2>
          <p className="text-sm text-[#8B6340]">{user?.university || 'Akademisi'}</p>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              prefetch
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 font-semibold transition-all ${
                active === item.key
                  ? 'bg-[#F3D580] text-[#5C3D1A]'
                  : 'hover:bg-[#F3D580]/30 text-[#8B6340] font-medium'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom: settings + logout — always visible */}
      <div className="px-8 py-6 border-t border-[#F0E5D5] flex flex-col gap-2">
        <Link
          prefetch
          href="/dashboard/instructor/settings"
          onClick={() => setIsOpen(false)}
          className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 transition-all ${
            active === 'settings'
              ? 'bg-[#F3D580] text-[#5C3D1A] font-semibold'
              : 'hover:bg-[#F3D580]/30 text-[#8B6340] font-medium'
          }`}
        >
          <Settings size={18} />
          Setting Profile
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full hover:bg-[#F3D580]/30 text-[#C0392B] rounded-xl px-4 py-3 font-semibold transition-all"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Hamburger button — mobile only, rendered in fixed top-left */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 p-2.5 rounded-lg bg-white border border-[#F0E5D5] shadow-sm text-[#5C3D1A] hover:bg-[#F5EFE9] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Buka menu"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — drawer on mobile, static on desktop */}
      <div
        className={`fixed md:static left-0 top-0 h-full z-50 md:z-auto transition-transform duration-300 md:translate-x-0 shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  )
}
