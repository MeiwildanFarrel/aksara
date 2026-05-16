import * as fs from 'fs'
import * as path from 'path'

// ── 0. Load .env.local FIRST ──────────────────────────────────────────────────
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.warn('[env] .env.local not found, relying on system env vars')
    return
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
  console.log('[env] Loaded .env.local')
}
loadEnvLocal()

// ── Guard required env vars ───────────────────────────────────────────────────
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY']
for (const key of required) {
  if (!process.env[key]) {
    console.error(`\n✗ ERROR: ${key} not found in env or .env.local`)
    process.exit(1)
  }
}

// ── Imports (after env loaded) ────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)


// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function stripCodeFence(raw: string): string {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  }
  return text.trim()
}

interface NodeSummary {
  summary: string
  key_points: string[]
  flash_cards: Array<{ front: string; back: string }>
}

// ── generateSummary: Gemini with retry, NO Groq fallback (Groq TPD exhausted) ─
async function generateSummaryForNode(
  nodeTitle: string,
  chunks: Array<{ content: string }>,
  attempt = 1,
): Promise<NodeSummary | null> {
  // Cap to 5 chunks max to stay within token limits
  const limited = chunks.slice(0, 5)
  const materi = limited.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')

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

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` +
    `?key=${process.env.GEMINI_API_KEY}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error(`     ✗ HTTP ${res.status}: ${errBody.slice(0, 200)}`)

      if ((res.status === 429 || res.status === 503) && attempt <= 2) {
        const waitSec = attempt === 1 ? 65 : 90
        console.log(`     ↺ Waiting ${waitSec}s before retry ${attempt}/2...`)
        await sleep(waitSec * 1000)
        return generateSummaryForNode(nodeTitle, chunks, attempt + 1)
      }
      return null
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!raw) { console.error('     ✗ Empty response from Gemini'); return null }

    const cleaned = stripCodeFence(raw)
    const parsed = JSON.parse(cleaned) as Record<string, unknown>

    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : ''

    if (!summary) { console.error('     ✗ No summary field in response'); return null }

    const key_points = Array.isArray(parsed.key_points)
      ? (parsed.key_points as unknown[])
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .map((p) => p.trim())
      : []

    const flash_cards = Array.isArray(parsed.flash_cards)
      ? (parsed.flash_cards as unknown[])
          .filter((fc): fc is { front: string; back: string } => {
            if (!fc || typeof fc !== 'object') return false
            const obj = fc as Record<string, unknown>
            return typeof obj.front === 'string' && typeof obj.back === 'string'
          })
          .map((fc) => ({
            front: (fc as { front: string; back: string }).front.trim(),
            back: (fc as { front: string; back: string }).back.trim(),
          }))
      : []

    return { summary, key_points, flash_cards }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`     ✗ Network/parse error (attempt ${attempt}): ${msg.slice(0, 150)}`)

    if (attempt <= 2) {
      const waitSec = attempt === 1 ? 65 : 90
      console.log(`     ↺ Waiting ${waitSec}s before retry ${attempt}/2...`)
      await sleep(waitSec * 1000)
      return generateSummaryForNode(nodeTitle, chunks, attempt + 1)
    }
    return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  AKSARA — Backfill summaries (Gemini only, capped chunks)')
  console.log('═══════════════════════════════════════════════════\n')

  // 1. Query nodes with NULL or empty summary
  const { data: nodes, error: nodesErr } = await supabase
    .from('skill_nodes')
    .select('id, title, session_id')
    .or('summary.is.null,summary.eq.')
    .order('id', { ascending: true })

  if (nodesErr) {
    console.error('[backfill] Failed to query skill_nodes:', nodesErr.message)
    process.exit(1)
  }

  if (!nodes || nodes.length === 0) {
    console.log('✓ No nodes need backfilling — all summaries already set.')
    process.exit(0)
  }

  console.log(`Found ${nodes.length} node(s) with missing summaries.\n`)

  let succeeded = 0
  let failed = 0

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const prefix = `[${i + 1}/${nodes.length}]`

    console.log(`${prefix} "${node.title}"`)

    // 2. Fetch chunks — cap at 5 to stay within token limits
    const { data: chunkRows, error: chunksErr } = await supabase
      .from('pdf_chunks')
      .select('content, source_ref')
      .eq('session_id', node.session_id)
      .limit(5)

    if (chunksErr) {
      console.error(`${prefix}   ✗ Chunk query failed: ${chunksErr.message}`)
      failed++
      continue
    }

    const chunks = (chunkRows ?? []).map((c: { content: string; source_ref: string | null }) => ({
      content: c.content,
      source_ref: c.source_ref ?? '',
    }))

    if (chunks.length === 0) {
      console.warn(`${prefix}   ⚠ No chunks for session ${node.session_id} — skip`)
      failed++
      continue
    }

    console.log(`${prefix}   → ${chunks.length} chunks → calling Gemini...`)

    // 3. Generate summary with retry
    const summary = await generateSummaryForNode(node.title, chunks)

    if (!summary) {
      console.warn(`${prefix}   ⚠ Generation failed — skip`)
      failed++
      await sleep(3000)
      continue
    }

    // 4. UPDATE skill_nodes
    const { error: updateErr } = await supabase
      .from('skill_nodes')
      .update({
        summary: summary.summary,
        key_points: summary.key_points,
        flash_cards: summary.flash_cards,
      } as any)
      .eq('id', node.id)

    if (updateErr) {
      console.error(`${prefix}   ✗ DB update failed: ${updateErr.message}`)
      failed++
      continue
    }

    console.log(`${prefix}   ✓ summary: "${summary.summary.slice(0, 70)}..."`)
    console.log(`${prefix}   ✓ ${summary.key_points.length} key_points | ${summary.flash_cards.length} flash_cards`)
    succeeded++

    // Throttle: ~4 req/min to stay under Gemini free tier (15 req/min)
    if (i < nodes.length - 1) await sleep(4000)
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Done: ${succeeded}✓  ${failed}✗  out of ${nodes.length}`)
  console.log('═══════════════════════════════════════════════════\n')
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[backfill] Fatal:', err)
  process.exit(1)
})
