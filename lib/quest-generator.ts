import { generateJson } from './gemini'

export interface ChunkInput {
  content: string
  source_ref?: string
}

export interface SkillTopic {
  title: string
  chunkIndices: number[]
}

export interface GeneratedQuest {
  question: string
  options: string[]
  correct_index: number
  bloom_level: number
}

export interface NodeSummary {
  summary: string | null
  key_points: string[]
  flash_cards: Array<{ front: string; back: string }>
}

export interface GeneratedVariant {
  question: string
  options: string[]
  correct_index: number
}

function stripCodeFence(raw: string): string {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  }
  return text.trim()
}

function extractJsonArray(raw: string): unknown {
  const cleaned = stripCodeFence(raw)
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('[')
    const end = cleaned.lastIndexOf(']')
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('No JSON array found in response')
    }
    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

function fallbackSkillTree(chunks: ChunkInput[]): SkillTopic[] {
  console.warn('[quest-gen] Using fallback skill tree - Gemini parse failed')
  if (chunks.length === 0) return []
  const topicsCount = Math.min(3, chunks.length)
  const perTopic = Math.ceil(chunks.length / topicsCount)
  const topics: SkillTopic[] = []
  for (let i = 0; i < topicsCount; i++) {
    const startIdx = i * perTopic
    const endIdx = Math.min(startIdx + perTopic, chunks.length)
    const indices: number[] = []
    for (let j = startIdx; j < endIdx; j++) indices.push(j)
    const firstChunkContent = chunks[startIdx].content ?? ''
    const title = firstChunkContent.split(' ').slice(0, 6).join(' ') + '...'
    topics.push({
      title,
      chunkIndices: indices,
    })
  }
  return topics
}

export async function generateSkillTree(
  chunks: Array<{ content: string; source_ref: string }>,
  sessionId: string,
): Promise<Array<{ title: string; chunkIndices: number[] }>> {
  console.log(
    `[quest-gen] generateSkillTree session=${sessionId} chunks=${chunks.length}`,
  )

  if (chunks.length === 0) return []

  const indexed = chunks
    .map((c, i) => `[${i}] ${c.content.slice(0, 400)}`)
    .join('\n\n')

  const topicRange =
    chunks.length < 10 ? '3-5' : chunks.length <= 20 ? '5-8' : '8-12'

  const prompt =
    `Dari materi berikut, identifikasi ${topicRange} topik utama yang membentuk skill ` +
    `tree pembelajaran. Setiap topik harus bisa dijadikan node belajar yang ` +
    `mandiri. Return HANYA JSON array dengan format: ` +
    `[{title: string, chunkIndices: number[]}] di mana chunkIndices adalah ` +
    `index chunk yang relevan untuk topik tersebut.\n` +
    `Pastikan setiap topik memiliki minimal 2 chunk yang relevan. ` +
    `Jika materi sangat panjang, buat topik yang lebih spesifik dan granular.\n\n` +
    `Materi (setiap chunk diawali dengan [index]):\n${indexed}`

  try {
    const raw = await generateJson(prompt)
    const parsed = extractJsonArray(raw)
    if (!Array.isArray(parsed)) throw new Error('Response is not an array')

    const topics: SkillTopic[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, unknown>
      const title = typeof obj.title === 'string' ? obj.title.trim() : ''
      const rawIndices = Array.isArray(obj.chunkIndices) ? obj.chunkIndices : []
      const chunkIndices = rawIndices
        .map((n) => (typeof n === 'number' ? Math.trunc(n) : Number.NaN))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < chunks.length)
      if (!title || chunkIndices.length === 0) continue
      topics.push({ title, chunkIndices })
    }

    if (topics.length === 0) {
      console.warn('[quest-gen] skill tree parse yielded 0 topics, using fallback')
      return fallbackSkillTree(chunks)
    }

    return topics
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[quest-gen] skill tree LLM failed (${message}), using fallback`)
    return fallbackSkillTree(chunks)
  }
}

function isValidQuest(obj: unknown): obj is GeneratedQuest {
  if (!obj || typeof obj !== 'object') return false
  const q = obj as Record<string, unknown>
  if (typeof q.question !== 'string' || q.question.trim().length === 0) return false
  if (!Array.isArray(q.options) || q.options.length !== 4) return false
  if (!q.options.every((o) => typeof o === 'string' && o.trim().length > 0)) return false
  if (typeof q.correct_index !== 'number') return false
  if (!Number.isInteger(q.correct_index)) return false
  if (q.correct_index < 0 || q.correct_index > 3) return false
  return true
}

export async function generateQuestsForNode(
  nodeTitle: string,
  relevantChunks: Array<{ content: string; source_ref: string }>,
  bloomLevel: number,
): Promise<
  Array<{
    question: string
    options: string[]
    correct_index: number
    bloom_level: number
  }>
> {
  if (relevantChunks.length === 0) return []

  const questCount =
    relevantChunks.length <= 2 ? 3 : relevantChunks.length <= 5 ? 5 : 8

  const materi = relevantChunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join('\n\n')

  const prompt =
    `Buat ${questCount} soal MCQ Bahasa Indonesia level Bloom ${bloomLevel} tentang topik ` +
    `"${nodeTitle}" berdasarkan materi berikut. Setiap soal punya 4 pilihan ` +
    `jawaban, tepat 1 benar.\n` +
    `Return HANYA JSON array:\n` +
    `[{question, options: string[4], correct_index, bloom_level}]\n` +
    `Pastikan soal relevan dengan materi, bukan pengetahuan umum.\n\n` +
    `Materi:\n${materi}`

  try {
    const raw = await generateJson(prompt)
    const parsed = extractJsonArray(raw)
    if (!Array.isArray(parsed)) return []

    const quests: GeneratedQuest[] = []
    for (const item of parsed) {
      if (!isValidQuest(item)) continue
      quests.push({
        question: item.question.trim(),
        options: item.options.map((o) => o.trim()),
        correct_index: item.correct_index,
        bloom_level: bloomLevel,
      })
    }
    return quests
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(
      `[quest-gen] generateQuestsForNode "${nodeTitle}" failed: ${message}`,
    )
    return []
  }
}

function isValidVariant(obj: unknown): obj is GeneratedVariant {
  if (!obj || typeof obj !== 'object') return false
  const q = obj as Record<string, unknown>
  if (typeof q.question !== 'string' || q.question.trim().length === 0) return false
  if (!Array.isArray(q.options) || q.options.length !== 4) return false
  if (!q.options.every((o) => typeof o === 'string' && o.trim().length > 0)) return false
  if (typeof q.correct_index !== 'number') return false
  if (!Number.isInteger(q.correct_index)) return false
  if (q.correct_index < 0 || q.correct_index > 3) return false
  return true
}

export async function generateVariants(
  originalQuest: { question: string; options: string[]; correct_index: number },
  chunks: Array<{ content: string }>,
): Promise<
  Array<{
    question: string
    options: string[]
    correct_index: number
  }>
> {
  const materi = chunks
    .slice(0, 4)
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join('\n\n')

  const original =
    `Pertanyaan: ${originalQuest.question}\n` +
    `Pilihan:\n` +
    originalQuest.options
      .map(
        (o, i) =>
          `${String.fromCharCode(65 + i)}. ${o}${
            i === originalQuest.correct_index ? ' (jawaban benar)' : ''
          }`,
      )
      .join('\n')

  const prompt =
    `Buat 2 variasi soal MCQ berbeda dari soal ini:\n${original}\n\n` +
    `Konsep yang diuji sama tapi kalimat dan pilihan jawaban harus berbeda.\n` +
    `Return HANYA JSON array 2 item:\n` +
    `[{question, options: string[4], correct_index}]\n\n` +
    (materi ? `Materi pendukung:\n${materi}` : '')

  try {
    const raw = await generateJson(prompt)
    const parsed = extractJsonArray(raw)
    if (!Array.isArray(parsed)) return []

    const variants: GeneratedVariant[] = []
    for (const item of parsed) {
      if (!isValidVariant(item)) continue
      variants.push({
        question: item.question.trim(),
        options: item.options.map((o) => o.trim()),
        correct_index: item.correct_index,
      })
    }
    return variants
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[quest-gen] generateVariants failed: ${message}`)
    return []
  }
}

const SUMMARY_FALLBACK: NodeSummary = {
  summary: null,
  key_points: [],
  flash_cards: [],
}

function isValidFlashCard(obj: unknown): obj is { front: string; back: string } {
  if (!obj || typeof obj !== 'object') return false
  const fc = obj as Record<string, unknown>
  return typeof fc.front === 'string' && typeof fc.back === 'string'
}

export async function generateNodeSummary(
  nodeTitle: string,
  relevantChunks: Array<{ content: string; source_ref: string }>,
): Promise<NodeSummary> {
  if (relevantChunks.length === 0) {
    console.warn('[quest-gen] Summary generation failed for node:', nodeTitle, '— will be backfilled later')
    return { ...SUMMARY_FALLBACK }
  }

  const materi = relevantChunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join('\n\n')

  const prompt =
    `Dari materi berikut tentang topik "${nodeTitle}", buat ringkasan pembelajaran dalam Bahasa Indonesia.\n` +
    `Return HANYA JSON dengan format:\n` +
    `{\n` +
    `  "summary": string (2-3 kalimat ringkasan),\n` +
    `  "key_points": string[] (5-7 poin penting),\n` +
    `  "flash_cards": [{"front": string, "back": string}] (4-6 flash card konsep kunci)\n` +
    `}\n` +
    `Gunakan bahasa yang mudah dipahami mahasiswa.\n\n` +
    `Materi:\n${materi}`

  try {
    const raw = await generateJson(prompt)
    const cleaned = stripCodeFence(raw)
    const parsed = JSON.parse(cleaned) as Record<string, unknown>

    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : null

    const key_points = Array.isArray(parsed.key_points)
      ? (parsed.key_points as unknown[])
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .map((p) => p.trim())
      : []

    const flash_cards = Array.isArray(parsed.flash_cards)
      ? (parsed.flash_cards as unknown[])
          .filter(isValidFlashCard)
          .map((fc) => ({ front: fc.front.trim(), back: fc.back.trim() }))
      : []

    return { summary, key_points, flash_cards }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[quest-gen] Summary generation failed for node:', nodeTitle, '— will be backfilled later')
    console.warn(`[quest-gen] generateNodeSummary detail: ${message}`)
    return { ...SUMMARY_FALLBACK }
  }
}
