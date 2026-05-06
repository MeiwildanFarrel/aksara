import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'
import { generateEmbedding, generateText } from './gemini'

export type ExplanationMode = 'eli5' | 'standard' | 'teknikal' | 'drill'

export interface RetrievedChunk {
  content: string
  source_ref: string
  similarity: number
}

const SIMILARITY_THRESHOLD = 0.5

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export async function retrieveChunks(
  query: string,
  sessionId: string,
  topK: number = 5,
): Promise<RetrievedChunk[]> {
  try {
    console.log(`[rag] retrieving top-${topK} chunks for session=${sessionId.slice(0, 8)}`)

    const queryEmbedding = await generateEmbedding(query)
    const client = getServiceClient()

    // The Database type doesn't yet include the new RPC functions
    // (regenerate via `supabase gen types` to remove this cast).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.rpc as any)('match_pdf_chunks', {
      query_embedding: toPgVector(queryEmbedding),
      match_session_id: sessionId,
      match_count: topK,
      similarity_threshold: SIMILARITY_THRESHOLD,
    })

    if (error) {
      console.error('[rag] retrieveChunks rpc error:', error.message)
      return []
    }

    const rows = (data as Array<{
      content: string
      source_ref: string | null
      similarity: number
    }> | null) ?? []

    const chunks: RetrievedChunk[] = rows.map((r) => ({
      content: r.content,
      source_ref: r.source_ref ?? 'sumber tidak diketahui',
      similarity: r.similarity,
    }))

    console.log(
      `[rag] retrieved ${chunks.length} chunks ` +
        `(top similarity: ${chunks[0]?.similarity.toFixed(3) ?? 'n/a'})`,
    )

    return chunks
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error('[rag] retrieveChunks failed:', message)
    return []
  }
}

const MODE_INSTRUCTIONS: Record<ExplanationMode, string> = {
  eli5:
    'Jelaskan menggunakan analogi sederhana dari kehidupan sehari-hari. ' +
    'Hindari jargon teknis. Anggap mahasiswa baru pertama kali mendengar topik ini.',
  standard:
    'Berikan penjelasan akademis ringkas dan jelas, tingkat sarjana. ' +
    'Gunakan istilah teknis seperlunya dan beri konteks ketika diperlukan.',
  teknikal:
    'Berikan penjelasan dengan notasi formal lengkap dan definisi presisi. ' +
    'Gunakan istilah teknis tanpa simplifikasi. Sertakan formula/notasi jika relevan.',
  drill:
    'JANGAN langsung menjawab pertanyaan. Gunakan metode Socratic: ' +
    'balik bertanya kepada mahasiswa untuk membimbing mereka menemukan jawaban sendiri. ' +
    'Ajukan 2-3 pertanyaan pancingan yang relevan dengan konteks yang tersedia.',
}

const CITATION_INSTRUCTION =
  'Sertakan referensi sumber di akhir jawaban dengan format: ' +
  'Sumber: [source_ref] (similarity: XX%)'

export async function buildRAGResponse(
  query: string,
  chunks: RetrievedChunk[],
  mode: ExplanationMode,
): Promise<string> {
  if (chunks.length === 0) {
    console.log('[rag] no chunks retrieved → returning fallback message')
    return 'Materi ini belum di-cover di mata kuliah ini.'
  }

  const context = chunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1}] (source_ref: ${c.source_ref}, similarity: ${(
          c.similarity * 100
        ).toFixed(0)}%)\n${c.content}`,
    )
    .join('\n\n')

  const prompt = [
    'Anda adalah AKSARA, AI Learning Copilot untuk pendidikan tinggi Indonesia.',
    'Jawab pertanyaan mahasiswa HANYA berdasarkan konteks dari modul kuliah berikut.',
    'Jangan mengarang informasi di luar konteks yang tersedia.',
    '',
    `MODE: ${mode.toUpperCase()}`,
    `INSTRUKSI MODE: ${MODE_INSTRUCTIONS[mode]}`,
    '',
    '=== KONTEKS DARI MODUL KULIAH ===',
    context,
    '=== AKHIR KONTEKS ===',
    '',
    `PERTANYAAN MAHASISWA: ${query}`,
    '',
    CITATION_INSTRUCTION,
  ].join('\n')

  console.log(
    `[rag] building response | mode=${mode} | chunks=${chunks.length} | prompt_chars=${prompt.length}`,
  )

  const response = await generateText(prompt)
  console.log(`[rag] LLM response generated (${response.length} chars)`)
  return response
}
