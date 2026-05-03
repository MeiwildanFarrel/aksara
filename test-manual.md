# Manual Testing Checklist — Project AKSARA

> Base URL: `http://localhost:3000`  
> Pastikan `npm run dev` sudah berjalan sebelum mulai.

---

## Persiapan: Ambil JWT Token (untuk TEST 2 & 3)

Token Supabase disimpan dalam **cookie HttpOnly** (bukan localStorage), 
jadi cara paling mudah mengambilnya adalah lewat DevTools browser.

### Langkah ambil token setelah login Google SSO:

1. Login via `http://localhost:3000/login`
2. Buka DevTools → tab **Application** → **Cookies** → `http://localhost:3000`
3. Cari cookie bernama `sb-<project_ref>-auth-token` (contoh: `sb-mryrutvzuvizlepvembt-auth-token`)
4. Copy value dari field tersebut — itu adalah JSON base64 encoded
5. Atau gunakan DevTools → tab **Console**, jalankan:

```js
// Cara 1: Ambil dari Supabase client di browser console
const { data } = await window.__supabase?.auth?.getSession()
console.log(data?.session?.access_token)

// Cara 2: Decode cookie auth-token secara manual
const raw = document.cookie
  .split('; ')
  .find(r => r.startsWith('sb-mryrutvzuvizlepvembt-auth-token'))
  ?.split('=')[1]
const session = JSON.parse(decodeURIComponent(raw))
console.log(session.access_token)
```

6. **Simpan `access_token`** — ini yang akan dipakai sebagai `Bearer` token di curl.

> **Catatan:** Token berlaku ~1 jam. Jika expired, login ulang.

---

## TEST 1 — Middleware Route Protection

### Skenario A: Akses `/dashboard` saat **belum login**

**Langkah:**
- [ ] Pastikan kamu belum login (atau buka browser incognito baru)
- [ ] Buka `http://localhost:3000/dashboard` di browser

**Expected Result:**
```
Browser diredirect otomatis ke: http://localhost:3000/login
Status response: 307 Temporary Redirect
```

**Verifikasi di terminal `npm run dev`:**
```
GET /dashboard 307 in Xms
GET /login 200 in Xms
```

**Jika tidak redirect (tetap 404):**
- Cek apakah middleware.ts sudah di-save
- Restart `npm run dev`

---

### Skenario B: Akses `/login` saat **sudah login**

**Langkah:**
- [ ] Login dulu via `http://localhost:3000/login` (Google SSO)
- [ ] Setelah berhasil login, ketik manual di address bar: `http://localhost:3000/login`

**Expected Result:**
```
Browser diredirect otomatis ke: http://localhost:3000/dashboard
Status response: 307 Temporary Redirect
```

**Verifikasi di terminal `npm run dev`:**
```
GET /login 307 in Xms
GET /dashboard 404 in Xms   ← 404 normal karena halaman /dashboard belum dibuat
```

---

### Skenario C: Akses `/api/protected/anything` saat belum login

**Dengan curl:**
```bash
curl -v http://localhost:3000/api/protected/anything
```

**Expected Result:**
```
< HTTP/1.1 307 Temporary Redirect
< Location: http://localhost:3000/login
```

---

## TEST 2 — POST `/api/auth/signout`

### Langkah: Login dulu via browser, ambil token (lihat bagian Persiapan)

### Test dengan curl:

```bash
# Ganti TOKEN dengan access_token yang sudah diambil
curl -X POST http://localhost:3000/api/auth/signout \
  -H "Cookie: sb-mryrutvzuvizlepvembt-auth-token=TOKEN_DARI_COOKIE" \
  -H "Content-Type: application/json" \
  -v
```

> **Catatan:** Signout di Supabase berbasis cookie session, bukan Authorization header.
> Pastikan `-H "Cookie: ..."` menggunakan nilai cookie yang benar dari browser.

**Alternatif via Thunder Client:**
- Method: `POST`
- URL: `http://localhost:3000/api/auth/signout`
- Headers: `Cookie: sb-mryrutvzuvizlepvembt-auth-token=<nilai dari browser>`
- Body: kosong

---

### Expected Response — Berhasil (200):
```json
{ "success": true }
```

### Expected Response — Gagal (500):
```json
{
  "success": false,
  "error": "pesan error dari Supabase"
}
```

### Verifikasi signout berhasil:
- [ ] Setelah POST signout, buka `http://localhost:3000/dashboard` di browser
- [ ] Harusnya redirect ke `/login` (session sudah habis)

---

## TEST 3 — GET `/api/user/me`

### Persiapan:
- [ ] Login via browser → ambil `access_token` (lihat bagian Persiapan di atas)
- [ ] Simpan token di variabel shell:

```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."   # paste token kamu di sini
```

---

### Test A: User sudah ada di tabel (atau insert pertama kali sebagai `student`)

```bash
curl -X GET "http://localhost:3000/api/user/me" \
  -H "Cookie: sb-mryrutvzuvizlepvembt-auth-token=$TOKEN" \
  -v
```

**Expected Response (200 — sudah ada di tabel):**
```json
{
  "id": "uuid-user-kamu",
  "email": "email@gmail.com",
  "role": "student",
  "created_at": "2026-05-03T10:00:00.000Z"
}
```

**Expected Response (201 — baru di-INSERT):**
```json
{
  "id": "uuid-user-kamu",
  "email": "email@gmail.com",
  "role": "student",
  "created_at": "2026-05-03T10:00:00.000Z"
}
```
Status HTTP 201 muncul di header response (`< HTTP/1.1 201 Created`).

---

### Test B: Insert dengan `?role=instructor`

```bash
# Hapus dulu data user dari tabel public.users di Supabase Dashboard
# supaya trigger INSERT, bukan SELECT yang sudah ada

curl -X GET "http://localhost:3000/api/user/me?role=instructor" \
  -H "Cookie: sb-mryrutvzuvizlepvembt-auth-token=$TOKEN" \
  -v
```

**Expected Response (201):**
```json
{
  "id": "uuid-user-kamu",
  "email": "email@gmail.com",
  "role": "instructor",
  "created_at": "2026-05-03T10:00:00.000Z"
}
```

---

### Test C: Tanpa login (no cookie)

```bash
curl -X GET "http://localhost:3000/api/user/me" -v
```

**Expected Response (401):**
```json
{ "error": "Unauthorized" }
```

---

### Verifikasi data masuk ke Supabase Dashboard:

1. Buka [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Pilih project `mryrutvzuvizlepvembt`
3. Klik **Table Editor** → pilih tabel `users`
4. Cek apakah row dengan `id` = UUID user kamu sudah muncul
5. Verifikasi kolom `role` sesuai dengan yang dikirim via `?role=`

---

## Cek Error di Supabase Dashboard → Logs

Jika ada endpoint yang tidak berjalan:

1. Buka [https://supabase.com/dashboard/project/mryrutvzuvizlepvembt/logs](https://supabase.com/dashboard/project/mryrutvzuvizlepvembt/logs)
2. Pilih log source yang relevan:

| Log Source | Kegunaan |
|---|---|
| **API** | Melihat request masuk ke PostgREST (query DB) |
| **Auth** | Melihat login, logout, token refresh event |
| **Database** | Melihat query SQL yang dieksekusi |
| **Edge Functions** | Jika pakai edge functions |

3. Filter berdasarkan waktu (pilih "Last 1 hour")
4. Cari error dengan keyword: `error`, `401`, `403`, `500`

### Error umum dan solusinya:

| Error | Kemungkinan Penyebab | Solusi |
|---|---|---|
| `relation "users" does not exist` | Tabel `public.users` belum dibuat | Jalankan SQL schema di Supabase SQL Editor |
| `JWT expired` | Token sudah kadaluarsa | Login ulang, ambil token baru |
| `new row violates row-level security` | RLS aktif tapi policy belum dibuat | Tambah RLS policy atau disable RLS sementara untuk testing |
| `null value in column "email"` | User Google tidak punya email | Cek `user.email` di auth callback |
| Cookie tidak terbaca | Cookie domain/path tidak cocok | Pastikan akses via `localhost:3000`, bukan `127.0.0.1` |

---

## Checklist Akhir

| # | Test Case | Status |
|---|---|---|
| 1a | `/dashboard` tanpa login → redirect `/login` | ⬜ |
| 1b | `/login` saat sudah login → redirect `/dashboard` | ⬜ |
| 1c | `/api/protected/*` tanpa login → redirect `/login` | ⬜ |
| 2a | `POST /api/auth/signout` berhasil → `{ success: true }` | ⬜ |
| 2b | Setelah signout, akses `/dashboard` → redirect `/login` | ⬜ |
| 3a | `GET /api/user/me` tanpa token → 401 Unauthorized | ⬜ |
| 3b | `GET /api/user/me` dengan token → 200 + data user | ⬜ |
| 3c | `GET /api/user/me?role=instructor` (user baru) → 201 + role instructor | ⬜ |
| 3d | Data user muncul di Supabase Table Editor | ⬜ |
