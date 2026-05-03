import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../../../../../lib/supabase/server'
import { chunkText } from '../../../../../lib/chunker'
import { generateEmbedding } from '../../../../../lib/gemini'
import type { Database } from '../../../../../types/supabase'

export const runtime = 'nodejs'

// pdf-parse has no TypeScript declarations; assign type manually
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> =
  require('pdf-parse')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse multipart form
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sessionId = formData.get('session_id') as string | null

    if (!file || !sessionId) {
      return NextResponse.json(
        { error: 'Field "file" dan "session_id" wajib diisi.' },
        { status: 400 }
      )
    }

    // 3. Validate file
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File harus berformat PDF.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file maksimal 10MB.' },
        { status: 400 }
      )
    }

    // 4. Validate session ownership
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('instructor_id', user.id)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session tidak ditemukan atau bukan milik Anda.' },
        { status: 403 }
      )
    }

    // 5. Extract text from PDF
    const arrayBuffer = await file.arrayBuffer()
    const pdfData = await pdfParse(Buffer.from(arrayBuffer))
    const { text, numpages } = pdfData

    if (!text.trim()) {
      return NextResponse.json(
        { error: 'PDF tidak mengandung teks yang dapat diekstrak.' },
        { status: 422 }
      )
    }

    // 6. Chunk
    const chunks = chunkText(text)
    console.log(
      `[upload/pdf] file="${file.name}" pages=${numpages} chunks=${chunks.length}`
    )

    // 7. Service role client — bypasses RLS for INSERT
    const serviceClient = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 8. Embed + insert sequentially to stay within Gemini free-tier rate limits
    let insertedCount = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const estimatedPage = Math.max(
        1,
        Math.ceil(((i + 1) / chunks.length) * numpages)
      )

      const embedding = await generateEmbedding(chunk)

      const { error: insertError } = await serviceClient
        .from('pdf_chunks')
        .insert({
          session_id: sessionId,
          content: chunk,
          // pgvector expects the string format "[n1,n2,...]"
          embedding: `[${embedding.join(',')}]`,
          source_ref: `hal. ${estimatedPage}`,
        })

      if (insertError) {
        console.error(`[upload/pdf] chunk ${i + 1} insert error: ${insertError.message}`)
      } else {
        insertedCount++
      }

      console.log(`[upload/pdf] chunk ${i + 1}/${chunks.length} done`)
    }

    return NextResponse.json(
      { success: true, chunks_created: insertedCount, session_id: sessionId },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[upload/pdf] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
