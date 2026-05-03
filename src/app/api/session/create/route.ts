import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

/** Generate PIN 6 digit angka, zero-padded. */
function generatePin(): string {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')
}

/** Cari PIN yang belum dipakai di tabel sessions. */
async function getUniquePin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const MAX_ATTEMPTS = 10

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const pin = generatePin()

    const { data, error } = await supabase
      .from('sessions')
      .select('id')
      .eq('pin', pin)
      .maybeSingle()

    if (error) {
      throw new Error(`Gagal cek keunikan PIN: ${error.message}`)
    }

    // Tidak ada row yang ditemukan → PIN aman dipakai
    if (!data) return pin
  }

  throw new Error('Gagal generate PIN unik setelah 10 percobaan.')
}

export async function POST(request: NextRequest) {
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

    // 2. Parse body
    const body = await request.json().catch(() => ({}))
    const { title } = body as { title?: string }

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json(
        { error: 'Field "title" wajib diisi dan tidak boleh kosong.' },
        { status: 400 }
      )
    }

    // 3. Generate PIN unik
    const pin = await getUniquePin(supabase)

    // 4. INSERT sesi baru
    const { data: session, error: insertError } = await supabase
      .from('sessions')
      .insert({
        instructor_id: user.id,
        title: title.trim(),
        pin,
      })
      .select('id, title, pin, created_at')
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: 'Gagal membuat sesi.', detail: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(session, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
