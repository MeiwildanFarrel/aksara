import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

/** Generate PIN 6 digit angka, zero-padded. */
function generatePin(): string {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type SessionRow = { id: string; title: string; pin: string; created_at: string }

/**
 * Atomic PIN generation: langsung INSERT, retry hanya jika
 * terjadi unique constraint violation (PostgreSQL error 23505).
 * Tidak ada race condition antara SELECT dan INSERT.
 */
async function insertSessionWithUniquePin(
  supabase: SupabaseClient,
  instructorId: string,
  title: string,
  MAX_RETRIES = 5,
): Promise<SessionRow> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const pin = generatePin()

    const { data, error } = await supabase
      .from('sessions')
      .insert({ instructor_id: instructorId, title, pin })
      .select('id, title, pin, created_at')
      .single()

    if (!error && data) return data as SessionRow

    // 23505 = unique_violation: PIN sudah dipakai → coba PIN baru
    if ((error as unknown as { code?: string })?.code === '23505') {
      console.warn(`[session/create] PIN ${pin} collision (attempt ${attempt + 1}), retrying...`)
      continue
    }

    // Error lain → lempar langsung
    throw new Error(error.message)
  }

  throw new Error('Gagal generate PIN unik setelah 5 percobaan.')
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

    // 3. Insert sesi dengan PIN unik — atomic, tidak ada race condition
    let session: SessionRow
    try {
      session = await insertSessionWithUniquePin(supabase, user.id, title.trim())
    } catch (insertErr) {
      const msg = insertErr instanceof Error ? insertErr.message : 'Gagal membuat sesi.'
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json(session, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
