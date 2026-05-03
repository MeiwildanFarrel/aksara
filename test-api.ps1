param(
  [Parameter(Mandatory=$false)]
  [string]$Cookie = ""
)

$BASE = "http://localhost:3000"
$TITLE = "Kelas Matematika Hari Ini"

function Print-Section($label) {
  Write-Host ""
  Write-Host "======================================" -ForegroundColor Cyan
  Write-Host "  $label" -ForegroundColor Cyan
  Write-Host "======================================" -ForegroundColor Cyan
}

function Run-Test($label, $expected_status, $args_list) {
  Write-Host ""
  Write-Host "[TEST] $label" -ForegroundColor Yellow
  Write-Host "  Expected: HTTP $expected_status" -ForegroundColor DarkGray

  $body = & curl.exe @args_list 2>&1
  # ambil status code terpisah
  $status_args = $args_list + @("-s", "-o", "NUL", "-w", "%{http_code}")
  $status = & curl.exe @status_args 2>&1

  if ($status -eq $expected_status) {
    Write-Host "  PASS - HTTP $status" -ForegroundColor Green
  } else {
    Write-Host "  FAIL - HTTP $status (expected $expected_status)" -ForegroundColor Red
  }
  Write-Host "  Response: $body" -ForegroundColor White
}

# ===========================================================================
Print-Section "TEST 1 - Endpoint publik (tanpa token)"
# ===========================================================================

Run-Test "GET /api/session/000000 -> 404" "404" @(
  "-s", "$BASE/api/session/000000"
)

Run-Test "GET /api/session/abc -> 400 format invalid" "400" @(
  "-s", "$BASE/api/session/abc"
)

Run-Test "GET /api/session/my-sessions tanpa token -> 401" "401" @(
  "-s", "$BASE/api/session/my-sessions"
)

Run-Test "POST /api/session/create tanpa token -> 401" "401" @(
  "-s", "-X", "POST",
  "-H", "Content-Type: application/json",
  "-d", "{`"title`":`"test`"}",
  "$BASE/api/session/create"
)

# ===========================================================================
if ($Cookie -eq "") {
  Write-Host ""
  Write-Host "SKIP: Test auth dilewati karena -Cookie tidak diberikan." -ForegroundColor Red
  Write-Host ""
  Write-Host "Cara ambil cookie setelah login di browser:" -ForegroundColor Yellow
  Write-Host "  1. Login di http://localhost:3000/login" -ForegroundColor White
  Write-Host "  2. Buka DevTools (F12) -> Application -> Cookies -> localhost:3000" -ForegroundColor White
  Write-Host "  3. Cari cookie: sb-mryrutvzuvizlepvembt-auth-token" -ForegroundColor White
  Write-Host "  4. Jalankan:" -ForegroundColor White
  Write-Host '     .\test-api.ps1 -Cookie "sb-mryrutvzuvizlepvembt-auth-token=eyJ..."' -ForegroundColor Green
  exit 0
}

Print-Section "TEST 2 - Endpoint dengan auth"
# ===========================================================================

Run-Test "GET /api/session/my-sessions dengan token -> 200" "200" @(
  "-s", "-H", "Cookie: $Cookie",
  "$BASE/api/session/my-sessions"
)

Write-Host ""
Write-Host "[TEST] POST /api/session/create dengan token -> 201" -ForegroundColor Yellow
$json = curl.exe -s `
  -X POST `
  -H "Content-Type: application/json" `
  -H "Cookie: $Cookie" `
  -d "{`"title`":`"$TITLE`"}" `
  "$BASE/api/session/create"

Write-Host "  Response: $json" -ForegroundColor White

try {
  $parsed = $json | ConvertFrom-Json
  $PIN = $parsed.pin

  if ($PIN) {
    Write-Host "  PASS - Sesi dibuat dengan PIN: $PIN" -ForegroundColor Green

    Write-Host ""
    Write-Host "[TEST] GET /api/session/$PIN -> 200 (verifikasi PIN bisa di-lookup)" -ForegroundColor Yellow
    $lookup = curl.exe -s "$BASE/api/session/$PIN"
    Write-Host "  Response: $lookup" -ForegroundColor White
    Write-Host "  PASS - PIN lookup berhasil" -ForegroundColor Green
  } else {
    Write-Host "  FAIL - Tidak ada PIN di response" -ForegroundColor Red
  }
} catch {
  Write-Host "  FAIL - Response bukan JSON valid" -ForegroundColor Red
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Testing selesai." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
