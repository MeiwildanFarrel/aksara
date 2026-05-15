import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
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
      .select('id, email, role, created_at, full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    if (queryError) {
      return NextResponse.json(
        { error: 'Gagal mengambil data user.', detail: queryError.message },
        { status: 500 },
      )
    }

    // 3. Jika sudah ada, langsung kembalikan data
    if (existingUser) {
      return NextResponse.json({
        ...existingUser,
        // prefer DB values (updated via /api/user/profile), fallback to auth metadata
        full_name: existingUser.full_name || user.user_metadata?.full_name || null,
        avatar_url: existingUser.avatar_url || user.user_metadata?.avatar_url || null,
      })
    }

    // 4. Belum ada di tabel
    const { searchParams } = new URL(request.url)
    const rawRole = searchParams.get('role')

    // Jika tidak ada parameter role (hanya mengecek apakah user sudah ada),
    // kita kembalikan status 200 dengan info bahwa role belum di-set.
    if (!rawRole) {
      return NextResponse.json({ exists: false, role: null }, { status: 200 })
    }

    // Jika ada parameter role, berarti dipanggil saat proses submit onboarding
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
        { error: 'Gagal membuat user.', detail: insertError.message },
        { status: 500 },
      )
    }

    return NextResponse.json(newUser, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[user/me] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
