import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ──────────────────────────────────────────────────────────────
// 1. Load .env.local
// ──────────────────────────────────────────────────────────────
function loadEnvLocal(): void {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.warn('[env] .env.local not found, relying on system environment variables')
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

// ──────────────────────────────────────────────────────────────
// Validate env
// ──────────────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY     ?? ''
const API_URL           = 'http://localhost:3000/api/ael/query'

const missing = (
  ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const
).filter((k) => !process.env[k])

if (missing.length > 0) {
  for (const k of missing) console.error(`✗ ERROR: ${k} tidak ditemukan di env atau .env.local`)
  process.exit(1)
}

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
type ExplanationMode = 'eli5' | 'standard' | 'teknikal' | 'drill'

interface AELResponse {
  answer?:  string
  sources?: Array<{ source_ref: string; similarity: number }>
  cached?:  boolean
  mode?:    string
  error?:   string
  detail?:  string
}

// ──────────────────────────────────────────────────────────────
// Print helper
// ──────────────────────────────────────────────────────────────
function sep(label?: string): void {
  const W = 64
  if (label) {
    const pad = W - label.length - 4
    console.log(`\n${'─'.repeat(Math.floor(pad / 2))} ${label} ${'─'.repeat(Math.ceil(pad / 2))}`)
  } else {
    console.log('─'.repeat(W))
  }
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // Service-role client — bypasses RLS, no user session needed
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Step 1: Get session_id from pdf_chunks ──────────────────
  sep('STEP 1: Get session_id from pdf_chunks')

  const { data: chunkRow, error: chunkErr } = await admin
    .from('pdf_chunks')
    .select('session_id')
    .not('session_id', 'is', null)
    .not('embedding',  'is', null)   // only sessions that have been embedded
    .limit(1)
    .maybeSingle()

  if (chunkErr) {
    console.error('✗ Query gagal:', chunkErr.message)
    process.exit(1)
  }
  if (!chunkRow?.session_id) {
    console.error('✗ Tabel pdf_chunks kosong atau belum ada embedding.')
    console.error('  Upload PDF via /api/upload/pdf, tunggu ~30 detik agar pg_cron memprosesnya.')
    process.exit(1)
  }

  const sessionId = chunkRow.session_id as string
  console.log(`✓ session_id: ${sessionId}`)

  // ── Auth headers (service role bypass) ─────────────────────
  // Authorization: Bearer <service_role_key>  — dikenali Supabase sebagai superuser
  // apikey: <anon_key>                        — required header oleh Supabase API gateway
  const AUTH_HEADERS: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'apikey':        SUPABASE_ANON_KEY,
  }

  // ── Fetch helper ─────────────────────────────────────────────
  async function queryAEL(
    query: string,
    mode:  ExplanationMode,
  ): Promise<{ result: AELResponse; latency: number; status: number }> {
    const t0  = Date.now()
    const res = await fetch(API_URL, {
      method:  'POST',
      headers: AUTH_HEADERS,
      body:    JSON.stringify({ query, session_id: sessionId, mode }),
    })
    const latency = Date.now() - t0
    const result  = (await res.json()) as AELResponse
    return { result, latency, status: res.status }
  }

  // ── TEST 1: 4 Explanation Modes ──────────────────────────────
  sep('TEST 1: Empat Explanation Mode')

  const QUERY = 'jelaskan konsep utama di materi ini'
  const MODES: ExplanationMode[] = ['eli5', 'standard', 'teknikal', 'drill']

  for (const mode of MODES) {
    sep(`MODE: ${mode.toUpperCase()}`)
    try {
      const { result, latency, status } = await queryAEL(QUERY, mode)

      if (status !== 200) {
        console.log(`✗ HTTP ${status}: ${result.error ?? 'unknown'}`)
        if (result.detail) console.log(`  detail: ${result.detail}`)
        continue
      }

      console.log(`Latency : ${latency}ms`)
      console.log(`Cached  : ${result.cached}`)
      console.log(`Sources : ${result.sources?.length ?? 0}`)

      for (const src of result.sources ?? []) {
        console.log(`  • ${src.source_ref}  (sim: ${(src.similarity * 100).toFixed(1)}%)`)
      }

      console.log(`\nAnswer:\n${result.answer ?? '(kosong)'}`)
    } catch (err) {
      console.error('✗ Error:', err instanceof Error ? err.message : err)
    }
  }

  // ── TEST 2: Cache Verification ───────────────────────────────
  sep('TEST 2: Cache Verification')

  const CACHE_QUERY = 'apa definisi konsep dasar dalam materi kuliah ini'
  console.log(`Query : "${CACHE_QUERY}"`)
  console.log(`Mode  : standard\n`)

  try {
    // Call 1 — should be a cache MISS
    console.log('[Call 1] Mengirim query (cache seharusnya MISS)...')
    const { result: r1, latency: l1, status: s1 } = await queryAEL(CACHE_QUERY, 'standard')

    if (s1 !== 200) {
      console.error(`✗ HTTP ${s1}: ${r1.error}`)
      return
    }

    const pass1 = r1.cached === false
    console.log(`  Latency : ${l1}ms`)
    console.log(`  Cached  : ${r1.cached}  ${pass1 ? '✓ (expected false)' : '✗ (expected false)'}`)
    console.log(`  Sources : ${r1.sources?.length ?? 0}`)

    // Call 2 — same query, should be a cache HIT
    console.log('\n[Call 2] Mengirim query yang sama (cache seharusnya HIT)...')
    const { result: r2, latency: l2, status: s2 } = await queryAEL(CACHE_QUERY, 'standard')

    if (s2 !== 200) {
      console.error(`✗ HTTP ${s2}: ${r2.error}`)
      return
    }

    const pass2   = r2.cached === true
    const speedup = l2 > 0 ? (l1 / l2).toFixed(1) : 'n/a'
    const allPass = pass1 && pass2

    console.log(`  Latency : ${l2}ms`)
    console.log(`  Cached  : ${r2.cached}  ${pass2 ? '✓ (expected true)' : '✗ (expected true)'}`)

    sep('Cache Test Result')
    console.log(`Call 1 (fresh)  : ${l1}ms  |  cached: ${r1.cached}`)
    console.log(`Call 2 (cached) : ${l2}ms  |  cached: ${r2.cached}`)
    console.log(`Speedup         : ${speedup}x`)
    console.log(`\nRESULT: ${allPass ? 'PASS ✓' : 'FAIL ✗'}`)
  } catch (err) {
    console.error('✗ Cache test error:', err instanceof Error ? err.message : err)
  }

  sep()
  console.log('Test selesai.')
}

main().catch((err) => {
  console.error('\n[FATAL]', err)
  process.exit(1)
})
