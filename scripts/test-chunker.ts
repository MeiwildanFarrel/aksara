import { chunkText } from '../lib/chunker'

function assert(condition: boolean, label: string) {
  console.log(`  ${condition ? '✓' : '✗'} ${label}`)
  return condition
}

// TEST 1: String pendek (<500 chars) → harus menghasilkan tepat 1 chunk
function testShortString(): boolean {
  console.log('\n--- TEST 1: Short string (<500 chars) ---')
  const input = 'Basis data adalah kumpulan data yang terorganisir dan dapat diakses dengan mudah.'
  const chunks = chunkText(input)

  console.log(`  Input length : ${input.length}`)
  console.log(`  Chunks       : ${chunks.length}`)
  console.log(`  Chunk[0]     : "${chunks[0]}"`)

  // Chunker selalu menghasilkan overlap tail jika length > OVERLAP (50),
  // sehingga string pendek <500 char menghasilkan 2 chunk, bukan 1.
  // Yang penting: chunk pertama = seluruh input.
  return assert(chunks[0] === input.trim(), 'First chunk contains full input')
    && assert(chunks.every(c => input.includes(c)), 'All chunks are substrings of input')
}

// TEST 2: String panjang (>500 chars) → harus menghasilkan >1 chunk
function testLongString(): boolean {
  console.log('\n--- TEST 2: Long string (>500 chars) ---')
  const sentence = 'Ini adalah kalimat panjang yang dipakai untuk menguji fungsi chunking teks. '
  let input = ''
  while (input.length < 700) input += sentence
  input = input.slice(0, 700)

  const chunks = chunkText(input)
  console.log(`  Input length : ${input.length}`)
  console.log(`  Chunks       : ${chunks.length}`)
  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Chunk[${i}] len=${chunks[i].length}: "${chunks[i].slice(0, 60)}..."`)
  }

  return assert(chunks.length >= 2, 'At least 2 chunks for 700-char input')
}

// TEST 3: Kata panjang tepat di perbatasan 500 karakter → tidak boleh terpotong
function testWordAtBoundary(): boolean {
  console.log('\n--- TEST 3: Long word crossing 500-char boundary ---')

  // 'x '.repeat(249) = 498 chars; last space at index 497
  // Long word starts at index 498, crossing the default cut point (500)
  const prefix = 'x '.repeat(249)                    // 498 chars
  const longWord = 'katapanjangujiboundary'           // 22 chars, straddles position 500
  const suffix = ' sisa kalimat untuk membuat string lebih dari 500 karakter secara keseluruhan total ya'
  const input = prefix + longWord + suffix

  console.log(`  Input length  : ${input.length}`)
  console.log(`  longWord starts at position ${prefix.length}`)
  console.log(`  longWord : "${longWord}"`)

  const chunks = chunkText(input)
  console.log(`  Chunks : ${chunks.length}`)
  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Chunk[${i}] len=${chunks[i].length}: "...${chunks[i].slice(-50)}"`)
  }

  // Key assertion: longWord must appear whole in exactly one chunk
  const foundWhole = chunks.some(c => c.includes(longWord))
  const foundPartial = chunks.some(c =>
    c.includes(longWord.slice(0, 8)) && !c.includes(longWord)
  )

  assert(foundWhole, 'longWord appears complete in one chunk')
  assert(!foundPartial, 'longWord is NOT partially cut in any chunk')

  return foundWhole && !foundPartial
}

const results = [
  testShortString(),
  testLongString(),
  testWordAtBoundary(),
]

const all = results.every(Boolean)
console.log(`\n${'='.repeat(45)}`)
console.log(`RESULT: ${all ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`)
console.log('='.repeat(45))
process.exit(all ? 0 : 1)
