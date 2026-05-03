import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { pin: string } }
) {
  try {
    const { pin } = params

    // Validasi format PIN: harus 6 digit angka
    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'Format PIN tidak valid. PIN harus 6 digit angka.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: session, error } = await supabase
      .from('sessions')
      .select('id, title, instructor_id, created_at')
      .eq('pin', pin)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: 'Gagal mengambil data sesi.', detail: error.message },
        { status: 500 }
      )
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Sesi tidak ditemukan.' },
        { status: 404 }
      )
    }

    return NextResponse.json(session)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
