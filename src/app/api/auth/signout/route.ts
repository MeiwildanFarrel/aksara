import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      return NextResponse.json(
        { error: 'Gagal sign out.', detail: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[auth/signout] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
