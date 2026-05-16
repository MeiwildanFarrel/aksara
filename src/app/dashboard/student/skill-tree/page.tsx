'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '../../../../../lib/supabase/client'
import StudentNav from '../components/StudentNav'
import skillTreeIcon from '../../../public/skill_tree.png'

type CourseData = {
  id: string
  title: string
  instructor: string
  created_at: string
  progress: number
  totalNodes: number
  status: 'Belum Dimulai' | 'Sedang Berjalan' | 'Selesai'
}

export default function CoursesSkillTreePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [courses, setCourses] = useState<CourseData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
      if (userRes.ok) setUser(await userRes.json())

      const saved = JSON.parse(localStorage.getItem('student_sessions') || '[]')
      const sessionIds = saved.map((s: any) => s.id).filter(Boolean)

      if (sessionIds.length === 0) {
        setCourses([])
        setLoading(false)
        return
      }

      // Fetch sessions + instructor
      const { data: sessionData } = await (supabase as any)
        .from('sessions')
        .select(`
          id, title, created_at,
          users ( full_name )
        `)
        .in('id', sessionIds)
        .eq('status', 'Active')

      if (!sessionData || sessionData.length === 0) {
        setCourses([])
        setLoading(false)
        return
      }

      const activeIds = sessionData.map((s: any) => s.id)

      // Fetch nodes to calculate progress
      const { data: nodesData } = await supabase
        .from('skill_nodes')
        .select('id, session_id')
        .in('session_id', activeIds)

      // Fetch mastery scores
      const { data: masteryData } = await supabase
        .from('mastery_scores')
        .select('node_id, score')
        .eq('user_id', auth.user.id)

      const courseList: CourseData[] = sessionData.map((session: any) => {
        const sessionNodes = (nodesData ?? []).filter(n => n.session_id === session.id)
        const totalNodes = sessionNodes.length
        let progress = 0

        if (totalNodes > 0) {
          const nodeIds = sessionNodes.map(n => n.id)
          const sessionScores = (masteryData ?? []).filter(m => m.node_id && nodeIds.includes(m.node_id))
          const totalScore = sessionScores.reduce((sum, m) => sum + (m.score ?? 0), 0)
          progress = Math.round((totalScore / totalNodes) * 100)
        }

        let status: CourseData['status'] = 'Belum Dimulai'
        if (progress >= 100) status = 'Selesai'
        else if (progress > 0) status = 'Sedang Berjalan'

        return {
          id: session.id,
          title: session.title,
          instructor: Array.isArray(session.users) ? session.users[0]?.full_name : session.users?.full_name || 'Instruktur',
          created_at: new Date(session.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
          progress,
          totalNodes,
          status,
        }
      })

      setCourses(courseList)
      setLoading(false)
    }

    loadData()
  }, [router])

  const statusStyle = (status: string) => {
    if (status === 'Selesai') return 'bg-[#2D7A49] text-white'
    if (status === 'Sedang Berjalan') return 'bg-[#FFC84D] text-[#6B4A00]'
    return 'bg-[#D8CCBC] text-[#5C5148]'
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0] flex flex-col">
      <StudentNav active="skill-tree" user={user} />

      <main className="flex-1 w-full max-w-[1000px] mx-auto px-4 md:px-8 py-10">
        
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-heading text-[32px] md:text-[38px] font-bold text-[#2C1A08] mb-2">Courses Skill Tree</h1>
          <p className="font-sans text-[14px] text-[#5C3D1A] max-w-[500px] leading-relaxed">
            Pilih modul untuk melihat progres keahlian dan melanjutkan perjalanan intelektual Anda.
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-[24px] p-6 border border-[#E8DCCB] animate-pulse h-[220px]">
                <div className="flex justify-between mb-4">
                  <div className="w-16 h-6 bg-[#E8DCCB] rounded-full" />
                  <div className="w-10 h-5 bg-[#E8DCCB] rounded" />
                </div>
                <div className="w-3/4 h-7 bg-[#E8DCCB] rounded mb-4" />
                <div className="w-1/2 h-4 bg-[#E8DCCB] rounded mb-2" />
                <div className="w-1/3 h-4 bg-[#E8DCCB] rounded mb-6" />
                <div className="w-full h-11 bg-[#E8DCCB] rounded-xl" />
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[24px] border border-[#E8DCCB]">
            <h2 className="font-heading text-xl font-bold text-[#2C1A08] mb-2">Belum ada course</h2>
            <p className="text-sm text-[#5C3D1A]">Anda belum bergabung dengan course apapun. Masukkan PIN untuk bergabung.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
              <div key={course.id} className="bg-white rounded-[24px] p-6 border border-[#E8DCCB] shadow-sm flex flex-col hover:shadow-md transition-shadow">
                
                {/* Top Row: Badge & Progress */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${statusStyle(course.status)}`}>
                    {course.status}
                  </span>
                  <span className="text-[12px] font-semibold text-[#5C3D1A]">
                    {course.totalNodes === 0 ? 'N/A' : `${course.progress}/100`}
                  </span>
                </div>

                {/* Info */}
                <h2 className="font-heading text-[22px] font-bold text-[#2C1A08] leading-tight mb-4 min-h-[52px]">
                  {course.title.length > 40 ? course.title.slice(0, 38) + '...' : course.title}
                </h2>
                
                <div className="mt-auto space-y-2 mb-6">
                  <p className="text-[13px] text-[#5C5148] font-sans">
                    Instruktur: {course.instructor}
                  </p>
                  <p className="text-[13px] text-[#8B7B6B] font-sans">
                    Dibuat: {course.created_at}
                  </p>
                </div>

                {/* Button */}
                <button
                  onClick={() => router.push(`/dashboard/student/skill-tree/${course.id}`)}
                  className="w-full bg-[#C8922A] hover:bg-[#A67520] text-white py-3 rounded-xl font-sans font-bold transition-colors flex items-center justify-center gap-2 shadow-sm text-[14px]"
                >
                  <Image src={skillTreeIcon} alt="Skill Tree" width={18} height={18} className="brightness-0 invert" />
                  Skill Tree
                </button>

              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
