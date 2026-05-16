import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await (supabase as any)
    .from('student_sessions')
    .select(`
      id,
      joined_at,
      sessions (
        id,
        title,
        pin,
        created_at,
        instructor_id,
        status
      )
    `)
    .eq('student_id', user.id)
    .order('joined_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sessions = (data ?? [])
    .filter((row: any) => row.sessions !== null)
    .map((row: any) => ({
      id: row.sessions.id,
      title: row.sessions.title,
      pin: row.sessions.pin,
      created_at: row.sessions.created_at,
      instructor_id: row.sessions.instructor_id,
      status: row.sessions.status,
      joined_at: row.joined_at,
    }))

  return NextResponse.json(sessions)
}
