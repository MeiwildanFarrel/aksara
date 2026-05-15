import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createClient()
    
    // Query the public users table (no admin key needed)
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url')
      .eq('id', params.userId)
      .single()
    
    if (error || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    return NextResponse.json({
      id: userData.id,
      email: userData.email,
      full_name: userData.full_name || null,
      avatar_url: userData.avatar_url || null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
