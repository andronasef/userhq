# Phase 1 Plan 08: Dev Upload Page, Proxy Gating, TanStack Mutation, Error Mapping, and Routed Upload E2E Summary

**Executed Date:** 2026-10-02  
**Status:** Completed & Verified  

---

## 1. Accomplishments

- **Next 16 Proxy Convention (`apps/web/proxy.ts`):**
  - Exported `proxy(request: NextRequest)` and `config = { matcher: ["/dev/:path*"] }`.
  - Pass-through when `DEV_UPLOAD_PAGE !== "true"` (unauthenticated and authenticated users receive identical 404).
  - Optimistic redirect: when `DEV_UPLOAD_PAGE === "true"` and `getSessionCookie(request)` is missing, responds with HTTP 307 and a relative `Location` header to `/login?next=%2Fdev%2Fupload`.
  - Verified: vinext runs `proxy.ts` on the Node runtime standalone container as expected, successfully executing the 307 redirect.
- **Dev Upload Route (`apps/web/app/dev/upload/page.tsx`):**
  - Server Component with metadata "Upload test · UserHQ".
  - Double gating: checks `isDevUploadEnabled()`, calling `notFound()` if false; checks `getMe()`, redirecting to `/login?next=%2Fdev%2Fupload` if unauthenticated.
  - Renders UI-SPEC header block with h1 "Upload test", "Dev only" badge, and description copy.
  - Mounts `UploadForm` inside `QueryProvider`.
- **Client Upload Form (`apps/web/app/dev/upload/upload-form.tsx`):**
  - Native file input (`#upload-file`, name `file`) with visible label "Image file", deliberately lacking an `accept` attribute to exercise server-side validation.
  - Selected-file line displaying `{filename} · {size}` (truncated with title attribute) or default helper text.
  - "Upload image" button (`variant="default"`, the sole accent button in Phase 1) with pending spinner and "Uploading…".
  - TanStack `useMutation` executing multipart POST to `/api/v1/uploads` with `credentials: "same-origin"`.
  - Success panel: "Upload complete" status alert, 320px capped `<img>` preview with `object-contain`, definition list for Format (WebP), Dimensions (`{w} × {h} px`), Size (`{n} KB`), and wrapping monospace URL (`break-all`), with a "Copy URL" button transitioning to "Copied" for 2 seconds.
  - Empty state: dashed placeholder panel with "No image uploaded yet" heading and copy.
  - Error alert: mapped title and body via `uploadErrorCopy`, with inline "Sign in again" link when `signInAgain === true` (HTTP 401).
- **Upload Error & Size Helpers (`apps/web/lib/upload-errors.ts`):**
  - Mapping covering all API codes: `file_too_large` (413), `unsupported_type` (415), `image_too_large` (422), `image_unreadable` (422), `no_file` (400), `unauthorized` (401), custom messages under 200 chars, and generic fallbacks.
  - `formatFileSize`: formats sub-1MiB to `{n} KB` (min 1 KB) and larger to `{n.n} MB`.
  - Unit tests: 12/12 passing in `apps/web/lib/upload-errors.test.ts`.
- **E2E Routed Upload Integration Test (`apps/api/test/e2e/upload-page.e2e.test.ts`):**
  - Case 1: Anonymous GET `/dev/upload` returns 307 redirect to `/login?next=%2Fdev%2Fupload`.
  - Case 2: Signed-in GET `/dev/upload` returns 200 with "Upload test", "Dev only", input `#upload-file`, and no `accept` attribute.
  - Case 3: Signed-in GET `/` contains "Test image uploads" link.
  - Case 4: Routed upload contract: 2000x1000 PNG POST returns 201 with downscaled 1600x800 WebP; GET of returned URL returns 200, `image/webp`, and `immutable` cache control; DB verification confirms `uploads` row with minted user's ID.
  - Case 5: Anonymous upload POST returns 401 `unauthorized`.

---

## 2. Verification Summary

| Check | Command / Assertion | Result |
|-------|---------------------|--------|
| E2E Upload Page Suite | `(cd apps/api && bun run test:e2e test/e2e/upload-page.e2e.test.ts)` | 5/5 passed |
| Volume Storage Scheme | `find /data/uploads -name '*.webp'` inside api container | `/data/uploads/2026/10/<uuid>.webp` verified |
| Runtime Flag-Off Gating | `DEV_UPLOAD_PAGE=false` container recreate without rebuild | `flag-off-ok 404` verified |
| Web Unit Tests | `(cd apps/web && bun run test)` | 39 passed |
| Linter | `bun run lint` | 0 errors, 0 warnings (63 files) |
| Typecheck | `bun run typecheck` | 0 errors across all 4 packages |
| Full Repo Tests | `bun run test` | All unit & integration test suites passed |

---

## 3. Deviations & Observations

- **PNG Fixture Generation in Tests:** Initial `pngOfSize(2000, 1000)` implementation in `apps/api/test/support/images.ts` filled image data with uncompressed `crypto.randomBytes()`, which produced ~6 MB PNGs exceeding the 2 MB boundary and returning 413. Switched `pngOfSize` to `sharp({ create: ... })` with solid color, producing valid PNGs of exact dimensions that compress under 2 MB.
- **Copy Deviations:** 0 copy deviations from UI-SPEC. All strings, alert titles, and button states match the Copywriting Contract verbatim.

---

## 4. Next Step

Advance to **Wave 8 — Plan 01-09**:
- Durability: database persistence across container down/up.
- Migration idempotency and concurrency race tests.
- SMTP probe script (`smtp:check`) and Mailpit profile verification.
