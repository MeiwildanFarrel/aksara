import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '../../../../types/supabase'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  let userId: string
  try {
    let session = null
    let lastError = null

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await supabase.auth.exchangeCodeForSession(code)
      if (!result.error && result.data.user) {
        session = result.data
        break
      }
      lastError = result.error
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    if (!session) {
      console.error('[auth/callback] exchangeCodeForSession failed after retry:', lastError)
      return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
    }
    userId = session.user.id
  } catch (err) {
    console.error('[auth/callback] unexpected error:', err)
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  const role = profile?.role
  if (role === 'instructor') {
    return NextResponse.redirect(`${origin}/dashboard/instructor`)
  }
  if (role === 'student') {
    return NextResponse.redirect(`${origin}/dashboard/student`)
  }
  return NextResponse.redirect(`${origin}/onboarding`)
}
