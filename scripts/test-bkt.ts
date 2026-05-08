import { updateMastery } from '../lib/bkt'

function assert(condition: boolean, label: string): boolean {
  console.log(`  ${condition ? '✓' : '✗'} ${label}`)
  return condition
}

function sep(label: string): void {
  console.log(`\n--- ${label} ---`)
}

const results: boolean[] = []

// TEST 1: Jawab benar dari 0.3 → expected ~0.47
sep('TEST 1: Benar dari 0.3')
const t1 = updateMastery(0.3, true)
console.log(`  Input : 0.3, correct = true`)
console.log(`  Output: ${t1.toFixed(4)}`)
results.push(assert(t1 > 0.67 && t1 < 0.71, `Result ~0.6893 (got ${t1.toFixed(4)})`))

// TEST 2: Jawab salah dari 0.7 → expected ~0.2955
sep('TEST 2: Salah dari 0.7')
const t2 = updateMastery(0.7, false)
console.log(`  Input : 0.7, correct = false`)
console.log(`  Output: ${t2.toFixed(4)}`)
results.push(assert(t2 > 0.27 && t2 < 0.32, `Result ~0.2955 (got ${t2.toFixed(4)})`))

// TEST 3: 5x benar berturut dari 0.3 → akhir harus > 0.8
sep('TEST 3: 5x benar berturut dari 0.3')
let score3 = 0.3
for (let i = 1; i <= 5; i++) {
  score3 = updateMastery(score3, true)
  console.log(`  Iterasi ${i}: ${score3.toFixed(4)}`)
}
results.push(assert(score3 > 0.8, `Akhir > 0.8 (got ${score3.toFixed(4)})`))

// TEST 4: 5x salah berturut dari 0.8 → akhir harus < 0.4
sep('TEST 4: 5x salah berturut dari 0.8')
let score4 = 0.8
for (let i = 1; i <= 5; i++) {
  score4 = updateMastery(score4, false)
  console.log(`  Iterasi ${i}: ${score4.toFixed(4)}`)
}
results.push(assert(score4 < 0.4, `Akhir < 0.4 (got ${score4.toFixed(4)})`))

// Ringkasan
const passed = results.filter(Boolean).length
console.log(`\n${'='.repeat(35)}`)
console.log(`RESULT: ${passed}/${results.length} tests passed — ${passed === results.length ? 'ALL PASS ✓' : 'SOME FAILED ✗'}`)
console.log('='.repeat(35))
process.exit(passed === results.length ? 0 : 1)
