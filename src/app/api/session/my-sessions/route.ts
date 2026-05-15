import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Autentikasi
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Query semua sesi milik instructor ini
    const { data: sessions, error: queryError } = await (supabase as any)
      .from('sessions')
      .select('id, title, pin, instructor_id, created_at, status')
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false })

    if (queryError) {
      return NextResponse.json(
        { error: 'Gagal mengambil daftar sesi.', detail: queryError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(sessions ?? [])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
