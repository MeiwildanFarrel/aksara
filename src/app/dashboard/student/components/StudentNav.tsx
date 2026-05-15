'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, CheckCircle2, Compass, LogOut, Medal, MessageSquareText, Trophy } from 'lucide-react'
import { createClient } from '../../../../../lib/supabase/client'
import notificationIcon from '../../../public/notification.png'
import settingsIcon from '../../../public/settings.png'

type StudentUser = {
  id?: string
  email?: string | null
  full_name?: string | null
  avatar_url?: string | null
  nim?: string | null
  tier?: string | null
}

type StudentNotification = {
  id: string
  title: string
  body: string
  timestamp: string
  tone: 'quest' | 'mastery' | 'feedback' | 'complete' | 'reminder'
}

const readKey = 'student_notifications_read_at'
const profileCacheKey = 'student_profile_cache'

function readCachedProfile(): StudentUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(profileCacheKey)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function mergeStudentUser(primary: StudentUser | null, fallback: StudentUser | null): StudentUser | null {
  if (!primary && !fallback) return null
  if (!primary) return fallback
  if (!fallback) return primary
  return {
    ...fallback,
    ...primary,
    full_name: primary.full_name || fallback.full_name || null,
    avatar_url: primary.avatar_url || fallback.avatar_url || null,
    nim: primary.nim || fallback.nim || null,
    tier: primary.tier || fallback.tier || null,
  }
}

function initials(name?: string | null, email?: string | null) {
  const source = (name || email?.split('@')[0] || 'Student').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function displayName(user: StudentUser | null) {
  return user?.full_name || user?.email?.split('@')[0] || 'Student Aksara'
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff)) return 'Baru saja'
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

function notificationStyle(tone: StudentNotification['tone']) {
  if (tone === 'mastery') return { icon: Trophy, bg: 'bg-[#6BBC86]', fg: 'text-[#153F24]' }
  if (tone === 'feedback') return { icon: MessageSquareText, bg: 'bg-[#FFE2A8]', fg: 'text-[#7A5200]' }
  if (tone === 'complete') return { icon: CheckCircle2, bg: 'bg-[#D7ECDD]', fg: 'text-[#196F3D]' }
  if (tone === 'reminder') return { icon: Bell, bg: 'bg-[#FAD2D0]', fg: 'text-[#B32128]' }
  return { icon: Compass, bg: 'bg-[#FFC84D]', fg: 'text-[#6B4A00]' }
}

export default function StudentNav({ active = 'dashboard', user: providedUser }: { active?: 'dashboard' | 'sessions' | 'skill-tree' | 'settings' | 'insights'; user?: StudentUser | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<StudentUser | null>(providedUser ?? null)
  const [notifications, setNotifications] = useState<StudentNotification[]>([])
  const [readAt, setReadAt] = useState('')
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cached = readCachedProfile()
    if (cached) {
      setUser((current) => mergeStudentUser(current, cached))
    }
  }, [])

  useEffect(() => {
    if (!providedUser) return
    const cached = readCachedProfile()
    setUser((current) => mergeStudentUser(providedUser, current ?? cached))
  }, [providedUser])

  useEffect(() => {
    const savedReadAt = localStorage.getItem(readKey) || ''
    setReadAt(savedReadAt)

    async function loadData() {
      const supabase = createClient()
      const [{ data: auth }, userRes] = await Promise.all([
        supabase.auth.getUser(),
        fetch('/api/user/me', { cache: 'no-store' }),
      ])

      if (!auth.user) {
        router.replace('/login')
        return
      }

      if (userRes.ok) {
        const data = await userRes.json()
        const cached = readCachedProfile()
        const merged = mergeStudentUser(data, cached)
        setUser(merged)
        if (merged?.avatar_url || merged?.full_name) {
          localStorage.setItem(profileCacheKey, JSON.stringify(merged))
        }
      }

      const saved = JSON.parse(localStorage.getItem('student_sessions') || '[]')
      const sessionIds = saved.map((item: any) => item.id).filter(Boolean)
      if (sessionIds.length === 0) {
        setNotifications([])
        return
      }

      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, title, pin, status, created_at')
        .in('id', sessionIds)

      const activeSessions = (sessions ?? []).filter((session: any) => session.status === 'Active')
      const activeIds = activeSessions.map((session: any) => session.id)
      if (activeIds.length === 0) {
        setNotifications([])
        return
      }

      const [{ data: nodes }, { data: masteryRows }, { data: attempts }] = await Promise.all([
        supabase.from('skill_nodes').select('id, title, session_id').in('session_id', activeIds),
        supabase.from('mastery_scores').select('node_id, score, updated_at').eq('user_id', auth.user.id),
        supabase.from('quest_attempts').select('quest_id, is_correct, attempted_at').eq('user_id', auth.user.id).order('attempted_at', { ascending: false }).limit(8),
      ])

      const nodeMap = new Map((nodes ?? []).map((node: any) => [node.id, node]))
      const sessionMap = new Map(activeSessions.map((session: any) => [session.id, session]))
      const masteryByNode = new Map((masteryRows ?? []).map((row: any) => [row.node_id, row]))
      const generated: StudentNotification[] = []

      activeSessions.forEach((session: any) => {
        const sessionNodes = (nodes ?? []).filter((node: any) => node.session_id === session.id)
        const incomplete = sessionNodes.filter((node: any) => (masteryByNode.get(node.id)?.score ?? 0) < 0.8)
        if (incomplete.length > 0) {
          generated.push({
            id: `quest-${session.id}`,
            title: 'New Quest Available',
            body: `"${session.title}" memiliki ${incomplete.length} quest yang siap dikerjakan.`,
            timestamp: session.created_at || new Date().toISOString(),
            tone: 'quest',
          })
        }
      })

      ;(masteryRows ?? []).forEach((row: any) => {
        const node = nodeMap.get(row.node_id)
        if (!node) return
        const session = sessionMap.get(node.session_id)
        const score = Math.round((row.score ?? 0) * 100)
        generated.push({
          id: `mastery-${row.node_id}-${row.updated_at}`,
          title: score >= 80 ? 'Quest Completed' : 'MMR Increase',
          body: `${node.title} di ${session?.title || 'sesi aktif'} sekarang ${score}% mastery.`,
          timestamp: row.updated_at || new Date().toISOString(),
          tone: score >= 80 ? 'complete' : 'mastery',
        })
      })

      const questIds = [...new Set((attempts ?? []).map((attempt: any) => attempt.quest_id).filter(Boolean))]
      let questMap = new Map<string, any>()
      if (questIds.length > 0) {
        const { data: quests } = await supabase.from('quests').select('id, node_id, question').in('id', questIds)
        questMap = new Map((quests ?? []).map((quest: any) => [quest.id, quest]))
      }

      ;(attempts ?? []).forEach((attempt: any) => {
        if (attempt.is_correct) return
        const quest = questMap.get(attempt.quest_id)
        const node = quest ? nodeMap.get(quest.node_id) : null
        generated.push({
          id: `feedback-${attempt.quest_id}-${attempt.attempted_at}`,
          title: 'Feedback Received',
          body: `Review pembahasan untuk ${node?.title || 'quest terakhir'} agar percobaan berikutnya lebih kuat.`,
          timestamp: attempt.attempted_at || new Date().toISOString(),
          tone: 'feedback',
        })
      })

      generated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setNotifications(generated.slice(0, 12))
    }

    loadData()
  }, [router, pathname])

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node
      if (profileRef.current && !profileRef.current.contains(target)) setIsProfileOpen(false)
      if (notifRef.current && !notifRef.current.contains(target)) setIsNotificationOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  const visibleNotifications = useMemo(() => {
    if (!readAt) return notifications
    const readTime = new Date(readAt).getTime()
    return notifications.filter((item) => {
      if (item.tone === 'reminder') return true
      return new Date(item.timestamp).getTime() > readTime
    })
  }, [notifications, readAt])

  const hasUnread = useMemo(() => {
    if (notifications.length === 0) return false
    if (!readAt) return true
    const readTime = new Date(readAt).getTime()
    return notifications.some((item) => item.tone === 'reminder' || new Date(item.timestamp).getTime() > readTime)
  }, [notifications, readAt])

  const handleMarkAllRead = () => {
    const now = new Date().toISOString()
    localStorage.setItem(readKey, now)
    setReadAt(now)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    localStorage.removeItem(profileCacheKey)
    router.replace('/login')
  }

  return (
    <header className="w-full bg-[#2C1A08] px-4 md:px-8 py-4 flex items-center justify-end relative overflow-visible z-30">
      <nav className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-center gap-8 z-10">
        <a href="/dashboard/student" className={`${active === 'dashboard' ? 'text-[#C8922A] font-semibold border-b-2 border-[#C8922A]' : 'text-[#C4A882] hover:text-white'} font-sans text-sm transition-colors pb-1`}>Dashboard</a>
        <a href="/dashboard/student/sessions" className={`${active === 'sessions' ? 'text-[#C8922A] font-semibold border-b-2 border-[#C8922A]' : 'text-[#C4A882] hover:text-white'} font-sans text-sm transition-colors pb-1`}>Sessions</a>
        <a href="/dashboard/student/skill-tree" className={`${active === 'skill-tree' ? 'text-[#C8922A] font-semibold border-b-2 border-[#C8922A]' : 'text-[#C4A882] hover:text-white'} font-sans text-sm transition-colors pb-1`}>Skill Tree</a>
        <a href="/dashboard/student/insights" className={`${active === 'insights' ? 'text-[#C8922A] font-semibold border-b-2 border-[#C8922A]' : 'text-[#C4A882] hover:text-white'} font-sans text-sm transition-colors pb-1`}>Insights</a>
      </nav>

      <div className="flex items-center gap-3 md:gap-6 z-10">
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotificationOpen((value) => !value)}
            className="relative w-10 h-10 opacity-90 hover:opacity-100 transition-opacity"
            aria-label="Notifications"
          >
            <Image src={notificationIcon} alt="Notifications" fill sizes="40px" className="object-contain" />
            {hasUnread && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#E74C3C] ring-2 ring-[#2C1A08]" />}
          </button>

          {isNotificationOpen && (
            <div className="absolute right-[-72px] md:right-0 top-14 w-[340px] md:w-[384px] max-h-[530px] overflow-hidden rounded-[24px] bg-white border border-[#E8DCCB] shadow-[0_22px_55px_rgba(44,26,8,0.25)]">
              <div className="flex items-center justify-between px-6 py-6 border-b border-[#E8DCCB]">
                <h2 className="font-heading text-[26px] font-bold text-[#2C1A08]">Notifications</h2>
                <button onClick={handleMarkAllRead} className="text-[13px] font-semibold text-[#7B5209] hover:text-[#C8922A]">Mark all read</button>
              </div>
              <div className="max-h-[372px] overflow-y-auto">
                {visibleNotifications.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <Bell className="mx-auto mb-3 text-[#C4A882]" size={28} />
                    <p className="font-sans text-sm text-[#8B6340]">Belum ada aktivitas baru.</p>
                  </div>
                ) : visibleNotifications.map((item) => {
                  const style = notificationStyle(item.tone)
                  const Icon = style.icon
                  return (
                    <div key={item.id} className="grid grid-cols-[42px_1fr] gap-4 px-6 py-6 border-b border-[#F0E8DC] last:border-b-0">
                      <div className={`h-10 w-10 rounded-full ${style.bg} ${style.fg} flex items-center justify-center`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <h3 className="font-sans text-[15px] font-bold text-[#2C1A08] leading-tight">{item.title}</h3>
                        <p className="mt-1 font-sans text-[14px] leading-snug text-[#5C3D1A]">{item.body}</p>
                        <p className="mt-2 font-sans text-[12px] text-[#8B6340]">{relativeTime(item.timestamp)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <button onClick={() => router.push('/dashboard/student/sessions')} className="w-full bg-[#FFF1E5] py-4 text-center text-[13px] font-semibold text-[#7B5209] hover:bg-[#F9E3CE]">
                View All Activity
              </button>
            </div>
          )}
        </div>

        <button onClick={() => router.push('/dashboard/student/settings')} className="relative w-10 h-10 opacity-90 hover:opacity-100 transition-opacity" aria-label="Settings">
          <Image src={settingsIcon} alt="Settings" fill sizes="40px" className="object-contain" />
        </button>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen((value) => !value)}
            className="relative w-9 h-9 rounded-full overflow-hidden border border-[#5C3D1A] bg-[#8B6340] flex items-center justify-center text-white font-sans text-xs hover:border-[#C8922A] transition-colors"
            aria-label="Profile"
          >
            {user?.avatar_url ? <img src={user.avatar_url} alt={displayName(user)} className="h-full w-full object-cover" /> : initials(user?.full_name, user?.email)}
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-14 w-[288px] overflow-hidden rounded-[26px] bg-[#FFF1E5] border border-[#E8DCCB] shadow-[0_24px_55px_rgba(44,26,8,0.24)]">
              <div className="flex flex-col items-center px-6 pt-7 pb-6">
                <div className="h-[62px] w-[62px] rounded-full bg-white ring-4 ring-white border border-[#E8DCCB] flex items-center justify-center overflow-hidden text-[#8B6340] font-bold">
                  {user?.avatar_url ? <img src={user.avatar_url} alt={displayName(user)} className="h-full w-full object-cover" /> : initials(user?.full_name, user?.email)}
                </div>
                <h3 className="mt-4 font-heading text-[25px] leading-none font-bold text-[#2C1A08] text-center">{displayName(user)}</h3>
                <p className="mt-1 font-sans text-[12px] text-[#8B6340]">NIM: {user?.nim || '-'}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#D39728] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-white">
                  <Medal size={13} />
                  {user?.tier || 'Bronze Scholar'}
                </div>
              </div>
              <div className="border-t border-[#D8CCBC] bg-white px-6 py-4">
                <button onClick={handleSignOut} className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#FAD2D0] py-3 text-[14px] font-bold text-[#B32128] hover:bg-[#F6C2BF]">
                  <LogOut size={17} />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
