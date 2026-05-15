import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
}

// Update profile while keeping Auth metadata small.
// Supabase SSR stores Auth metadata in cookies, so avatar data URLs must not live there.
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders })
    }
    
    const body = await request.json()
    const { full_name, avatar_url, university, phone, research_field, nim, faculty, study_program, tier } = body
    
    // Validate email presence of @
    if (body.email && !body.email.includes('@')) {
      return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400, headers: noStoreHeaders })
    }
    
    // 1. Update Supabase Auth user metadata with small fields only.
    // Clear avatar_url in case an older save already put a large base64 image in the session cookie.
    const { error: updateAuthError } = await supabase.auth.updateUser({
      data: { full_name, university, phone, research_field, nim, faculty, study_program, tier, avatar_url: null }
    })
    
    if (updateAuthError) throw updateAuthError
    
    // 2. Update table progressively so older DBs still save the avatar/name.
    const updatePayloads = [
      {
        full_name: full_name || null,
        avatar_url: avatar_url || null,
        phone: phone || null,
        nim: nim || null,
        university: university || null,
        faculty: faculty || null,
        study_program: study_program || null,
        tier: tier || 'Bronze Scholar',
      },
      {
        full_name: full_name || null,
        avatar_url: avatar_url || null,
        phone: phone || null,
        university: university || null,
      },
      {
        full_name: full_name || null,
        avatar_url: avatar_url || null,
      },
    ]

    let savedToUsersTable = false
    for (const payload of updatePayloads) {
      const { error: updateError } = await (supabase as any)
        .from('users')
        .update(payload)
        .eq('id', user.id)

      if (!updateError) {
        savedToUsersTable = true
        break
      }

      console.error('[profile/update] table update fallback:', updateError.message)
    }

    if (!savedToUsersTable) {
      console.error('[profile/update] table update failed for every payload')
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: body.email || user.email || null,
        full_name: full_name || null,
        avatar_url: avatar_url || null,
        university: university || null,
        phone: phone || null,
        research_field: research_field || null,
        nim: nim || null,
        faculty: faculty || null,
        study_program: study_program || null,
        tier: tier || 'Bronze Scholar',
      },
    }, { headers: noStoreHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders })
  }
}
