# Phase 1 Plan 07: Upload Pipeline & Boot-Time Migrations Summary

**Executed Date:** 2026-10-02  
**Status:** Completed & Verified  

---

## 1. Accomplishments

- **Database Schema & Boot Migration (`packages/db/src/schema/uploads.ts`, `0001_uploads.sql`):**
  - Created `uploads` table with columns: `id` (uuid defaultRandom), `storage_key` (text unique not null), `uploader_id` (text fk `user(id)` with `onDelete: "set null"`), `bytes`, `width`, `height`, and `created_at` (timestamptz defaultNow).
  - Generated and committed `migrations/0001_uploads.sql` with journal entry and snapshot.
  - Verified live boot migration apply: when the rebuilt container started, the migration count in `drizzle.__drizzle_migrations` advanced from 1 to 2 without volume reset, and existing canary user row was preserved (ROADMAP success criterion 3).
- **Safe Image Processing Pipeline (`apps/api/src/uploads/image-pipeline.ts`):**
  - Configured Sharp with `sharp.concurrency(1)` and `sharp.cache(false)` and a module-level serial queue to protect small VPS memory.
  - Magic-byte detection via `file-type` enforcing allowlist: `image/png`, `image/apng`, `image/jpeg`, `image/webp`, `image/gif`.
  - Sharp decode safeguards: `limitInputPixels: 40_000_000` (40 MP decompression bomb guard), `failOn: "warning"`, `animated: false` (extracts first frame only).
  - Normalization: `.rotate()` auto-orients from EXIF before stripping, `.resize({ width: 1600, withoutEnlargement: true })` caps maximum width without upscaling, and `.webp({ quality: 80 })` re-encodes. EXIF, ICC, and XMP metadata are completely stripped.
- **Storage Subsystem & Boot Probe (`apps/api/src/uploads/storage.ts`):**
  - Unguessable UTC path generator `uploadKey`: `YYYY/MM/<uuid>.webp`.
  - Atomic file write: writes to `<UPLOAD_DIR>/.tmp/<uuid>` with flag `wx`, validates path to prevent traversal, creates destination directory, and renames atomically on the same filesystem. Temp files are cleaned up on error.
  - Boot-time probe `assertWritable`: creates `<UPLOAD_DIR>/.tmp` and verifies write/delete of `.probe`. If uncreatable/read-only, the API logs `uploads: ...` and exits with code 1.
- **Upload API Controller (`apps/api/src/uploads/uploads.controller.ts`):**
  - `POST /api/v1/uploads` protected by default `SessionGuard` (requires sign-in) and `OriginGuard`.
  - Multer limits enforced: `fileSize: UPLOAD_MAX_BYTES` (2 MB), `files: 1`, `fields: 0` (no extra fields accepted, e.g. `purpose`). Client-provided `originalname` is never used.
  - Controller-scoped `MulterExceptionFilter` maps `LIMIT_FILE_SIZE` / `PayloadTooLargeException` to 413 `{ code: "file_too_large", message: "Images must be 2 MB or smaller." }` and bad request / unexpected field errors to 400 `{ code: "no_file", message: "Send exactly one image in the file field." }`.
  - Inserts database row after successful write; removes file on DB error. Returns `UploadResponseSchema.parse(...)`.
- **Static Asset Serving & Hardened Headers (`apps/api/src/app.module.ts`):**
  - Configured `useStaticAssets(env.UPLOAD_DIR, { prefix: "/uploads", immutable: true, maxAge: "365d", index: false, redirect: false, dotfiles: "deny", fallthrough: false })`.
  - Emits security headers: `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`, `Cross-Origin-Resource-Policy: same-origin`.
  - Directory listing is disabled (returns 404), and dotfiles (`/.tmp/*`) are denied.
- **Comprehensive Test Matrix (`apps/api/test/uploads.test.ts`, `apps/api/test/support/images.ts`):**
  - Authored 34 unit/integration tests running against real PostgreSQL and Sharp covering all UPLD-01 rules.

---

## 2. Key Metrics & Observations

### Migration Verification (ROADMAP Success Criterion 3)
- **Baseline Migration Count:** 1 (`0000_auth`)
- **Canary User Row:** `sc3-canary|SC3 Canary|sc3-canary@example.invalid` inserted prior to rebuild
- **Rebuilt Container Migration Count:** 2 (`0001_uploads` automatically applied at boot)
- **Canary User Preserved:** Verified `sc3-canary` intact across container rebuild with no volume wipe
- **In-Container Health Check:** `uploads-container-ok {"status":"ok","db":"up"} 404`

### Multer Boundary Behavior
- **Exact Boundary Accepted:** A valid PNG padded to exactly **2,097,152 bytes** (2 MB) returned HTTP **201 Created**.
- **Oversized Rejected:** A valid PNG padded to **2,097,153 bytes** (2 MB + 1 byte) was rejected by Multer with HTTP **413 Payload Too Large** and `{ code: "file_too_large", message: "Images must be 2 MB or smaller." }`.

### Peak Container RSS & Performance
- **Peak RSS during 8-way Parallel Concurrency:**
  ```
  CONTAINER ID   NAME           CPU %   MEM USAGE / LIMIT     MEM %   NET I/O
  902de118b7e6   userhq-api-1   0.00%   61.06MiB / 3.813GiB   1.56%   5.91kB / 4.02kB
  ```
- Memory usage remained low and steady (~61 MiB) due to `sharp.concurrency(1)` and the in-process serialization queue.

### Fixture Sizes Produced
| Fixture Input | Input Dimensions | Input Bytes | Output Dimensions | Output Bytes (WebP) |
|---------------|------------------|-------------|-------------------|---------------------|
| 2000x1000 PNG | 2000 x 1000 | 6,011,703 | 1600 x 800 | 766,562 |
| 1600x900 PNG | 1600 x 900 | 4,328,628 | 1600 x 900 | 977,016 |
| 800x600 PNG | 800 x 600 | 1,443,224 | 800 x 600 | 326,532 |
| 3000x2000 PNG | 3000 x 2000 | 18,033,955 | 1600 x 1067 | 843,174 |
| EXIF GPS JPEG | 100 x 100 | 643 | 100 x 100 | 100 |
| Animated GIF (3 frames) | 2 x 2 | 89 | 2 x 2 (1 frame) | 44 |
| APNG (2 frames) | 20 x 20 | 1,329 | 20 x 20 (1 frame) | 534 |

---

## 3. Verification Summary

| Check | Command / Assertion | Result |
|-------|---------------------|--------|
| Test Matrix | `(cd apps/api && bun run test test/uploads.test.ts)` | 34/34 passed (0 failed) |
| Typecheck | `bun run typecheck` | 0 errors across 4 workspaces |
| Linter | `bun run lint` | 0 errors, 0 warnings (32 files, 99 rules) |
| In-Container Static Asset Check | `fetch('http://127.0.0.1:4000/uploads/does-not-exist.webp')` | 404 (fallthrough off) |
| Boot Probe Directory Check | `fs.existsSync('/data/uploads/.tmp')` | `true` |
| Live Migration Count | `select count(*) from drizzle.__drizzle_migrations` | Exactly `2` |

---

## 4. Next Step

Proceed to Wave 5:
- **Plan 01-05:** `/login` with Google/GitHub, safe `?next=`, OAuth error mapping, and local Caddy dev loop.
