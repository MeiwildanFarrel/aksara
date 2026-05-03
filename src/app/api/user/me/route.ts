import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // 1. Ambil user dari session yang valid
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Cek apakah user sudah ada di tabel public.users
  const { data: existingUser, error: queryError } = await supabase
    .from('users')
    .select('id, email, role, created_at')
    .eq('id', user.id)
    .single()

  if (queryError && queryError.code !== 'PGRST116') {
    // PGRST116 = row not found, error lain berarti ada masalah DB
    return NextResponse.json(
      { error: 'Database error', detail: queryError.message },
      { status: 500 }
    )
  }

  // 3. Jika sudah ada, langsung kembalikan data
  if (existingUser) {
    return NextResponse.json(existingUser)
  }

  // 4. Belum ada di tabel → INSERT baru
  const { searchParams } = new URL(request.url)
  const rawRole = searchParams.get('role')
  const role: 'instructor' | 'student' =
    rawRole === 'instructor' ? 'instructor' : 'student'

  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      id: user.id,
      email: user.email ?? '',
      role,
    })
    .select('id, email, role, created_at')
    .single()

  if (insertError) {
    return NextResponse.json(
      { error: 'Failed to create user', detail: insertError.message },
      { status: 500 }
    )
  }

  return NextResponse.json(newUser, { status: 201 })
}
