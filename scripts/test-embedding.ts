import * as fs from 'fs'
import * as path from 'path'

// Load .env.local before importing gemini (which reads GEMINI_API_KEY at module init)
function loadEnvLocal() {
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
    if (key && !process.env[key]) {
      process.env[key] = val
    }
  }
  console.log('[env] Loaded .env.local')
}

loadEnvLocal()

// Guard before import so the GoogleGenerativeAI constructor doesn't throw
if (!process.env.GEMINI_API_KEY) {
  console.error('\n✗ ERROR: GEMINI_API_KEY tidak ditemukan di env atau .env.local')
  console.error('\nCara set di PowerShell (satu kali per terminal):')
  console.error('  $env:GEMINI_API_KEY="AIza..."')
  console.error('\nAtau tambahkan di .env.local:')
  console.error('  GEMINI_API_KEY=AIza...')
  console.error('\nDapatkan API key di: https://aistudio.google.com/apikey')
  process.exit(1)
}

import { generateEmbedding } from '../lib/gemini'

async function main() {
  const query = 'Apa itu basis data?'
  console.log(`\nTesting generateEmbedding("${query}")`)
  console.log(`Using key: ${process.env.GEMINI_API_KEY!.slice(0, 8)}...`)

  try {
    const start = Date.now()
    const embedding = await generateEmbedding(query)
    const elapsed = Date.now() - start

    console.log(`\nLatency   : ${elapsed}ms`)
    console.log(`Type      : ${typeof embedding} | Array: ${Array.isArray(embedding)}`)
    console.log(`Length    : ${embedding.length}`)
    console.log(`First 5   : [${embedding.slice(0, 5).map(n => n.toFixed(6)).join(', ')}]`)
    console.log(`Last  5   : [${embedding.slice(-5).map(n => n.toFixed(6)).join(', ')}]`)

    const isArray = Array.isArray(embedding)
    const correctLength = embedding.length === 768
    const allNumbers = embedding.every(v => typeof v === 'number' && isFinite(v))
    const nonZero = embedding.some(v => v !== 0)

    console.log('\nAssertions:')
    console.log(`  ${isArray ? '✓' : '✗'} Result is Array`)
    console.log(`  ${correctLength ? '✓' : '✗'} Length === 768 (got ${embedding.length})`)
    console.log(`  ${allNumbers ? '✓' : '✗'} All values are finite numbers`)
    console.log(`  ${nonZero ? '✓' : '✗'} Values are non-zero (not empty vector)`)

    const pass = isArray && correctLength && allNumbers && nonZero
    console.log(`\n${'='.repeat(45)}`)
    console.log(`RESULT: ${pass ? 'PASS ✓' : 'FAIL ✗'}`)
    console.log('='.repeat(45))
    process.exit(pass ? 0 : 1)
  } catch (err) {
    const e = err as { status?: number; message?: string }
    console.error('\n✗ Error saat memanggil Gemini API:')
    console.error(`  ${e.message ?? String(err)}`)

    if (e.status === 429) {
      console.error('\nRate limit (429) tercapai.')
      console.error('Cek kuota di: https://aistudio.google.com/app/usage')
      console.error('Free tier: 1,500 req/hari, 15 req/menit untuk embedding-001')
    } else if (e.status === 400) {
      console.error('\nAPI key tidak valid atau model tidak tersedia.')
    } else if (e.status === 403) {
      console.error('\nAPI key tidak punya akses ke Gemini Embedding API.')
      console.error('Pastikan "Generative Language API" sudah diaktifkan di Google Cloud Console.')
    }
    process.exit(1)
  }
}

main()
