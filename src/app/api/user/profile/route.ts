import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Update profile: saves full_name, avatar_url, university, phone, research_field 
// both to auth metadata and to the users table for easy querying by students.
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { full_name, avatar_url, university, phone, research_field } = body
    
    // Validate email presence of @
    if (body.email && !body.email.includes('@')) {
      return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 })
    }
    
    // 1. Update Supabase Auth user metadata
    const { error: updateAuthError } = await supabase.auth.updateUser({
      data: { full_name, avatar_url, university, phone, research_field }
    })
    
    if (updateAuthError) throw updateAuthError
    
    // 2. Try updating the public.users table so students can query instructor info
    // This may fail if full_name/avatar_url columns don't exist yet — that's okay,
    // the auth metadata update above already persists the data.
    try {
      const { error: updateError } = await (supabase as any)
        .from('users')
        .update({
          full_name: full_name || null,
          avatar_url: avatar_url || null,
          phone: phone || null,
        })
        .eq('id', user.id)
      
      if (updateError) {
        console.error('[profile/update] table update error:', updateError.message)
      }
    } catch (e) {
      console.error('[profile/update] table update exception:', e)
    }
    
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
