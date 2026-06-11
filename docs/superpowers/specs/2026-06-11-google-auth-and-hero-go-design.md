# Design — Google auth + "Go!" → calculator with YouTube views

Date: 2026-06-11
Status: approved (design), pending spec review

Two independent features, brainstormed together, executed multi-agent on separate
tracks:

- **Feature A — Google authentication** (login + registration), server-side
  Authorization Code flow.
- **Feature B — Hero "Go!"** carries the link into the calculator with the
  "YouTube views" service pre-selected.

They share no code. Track A is backend-heavy + frontend; Track B is frontend-only.

---

## Feature A — Google authentication

### Flow (server-side Authorization Code)

1. User clicks "Continue with Google" on `/login` or `/register` → full-page
   navigation to `GET /api/auth/google`.
2. Backend generates a random `state`, stores it in Redis
   (`oauth:state:<state>`, TTL 10 min), redirects to Google's authorize endpoint
   with scope `openid email profile`.
3. Google redirects to `GET /api/auth/google/callback?code&state`.
4. Backend validates `state` against Redis (single-use: delete on read),
   exchanges `code` for tokens, verifies the `id_token` and extracts
   `sub` (googleId), `email`, `email_verified`.
5. `loginWithGoogle({ googleId, email, emailVerified })` resolves a user (see
   below) and issues our own `TokenPair`.
6. Backend redirects to
   `${WEB_URL}/auth/google/callback#accessToken=…&refreshToken=…`.
   On any error → `${WEB_URL}/login?error=google`.
7. The frontend callback page reads `location.hash`, stores the refresh token in
   `localStorage` and the access token in memory (via a new
   `auth-context.setSession(tokens)`), clears the hash, and routes to
   `/dashboard`.

Rationale for the fragment handoff: it matches the existing token model (refresh
in `localStorage`, access in memory) with the smallest surface, and the URL
fragment is never sent to the server or written to access logs.

### User resolution (`loginWithGoogle`)

- Found by `googleId` → issue tokens.
- Else found by `email` → link `googleId` onto that account, then issue tokens.
- Else create a new user: `googleId`, `email`, `username` derived from the email
  local part (sanitized to `[a-z0-9_]`, truncated to 30 chars, numeric suffix on
  collision), `emailVerified = true` (Google-verified), `passwordHash = null`,
  `isAutoCreated = false`. Then issue tokens.

Token issuance reuses the existing `generateAccessToken` / `generateRefreshToken`
/ `tokenStore.saveRefreshToken` helpers — identical to `login()`.

### Schema change (`prisma/schema.prisma` + new Prisma migration)

```prisma
model User {
  // ...
  passwordHash String? @map("password_hash") @db.VarChar(255)  // was non-null
  googleId     String? @unique @map("google_id") @db.VarChar(255)
  // ...
}
```

- `passwordHash` becomes nullable (Google users have no password). The
  password `login()` gains a guard: if `user.passwordHash == null` →
  `UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS')` (never reveal
  that the account is Google-only).
- New Prisma migration created with `prisma migrate dev`; prod applies it via the
  existing `youboost-migrate` container (`prisma migrate deploy`).

### Config (`src/shared/config/env.ts`)

New env vars (real values in `.env`, never committed):

- `GOOGLE_CLIENT_ID` (required when Google auth enabled)
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` = `https://www.youboost.store/api/auth/google/callback`
- `WEB_URL` = `https://www.youboost.store` (dev: `http://localhost:3101`)

Google Cloud Console: add the redirect URI above (and the dev one
`http://localhost:3100/api/auth/google/callback` if testing the backend directly,
or `http://localhost:3101/...` via the dev proxy) to the OAuth client.

### Backend units

- `src/modules/auth/auth-google.service.ts` — wraps `google-auth-library`
  `OAuth2Client`: `buildAuthUrl(state)`, `exchangeCode(code) → { googleId, email,
emailVerified }` (via `getToken` + `verifyIdToken`). New dependency:
  `google-auth-library`.
- `auth.service.ts` — add `loginWithGoogle(profile) → TokenPair`; add the
  null-password guard to `login()`.
- `auth.routes.ts` — add `GET /auth/google` and `GET /auth/google/callback`
  (these issue redirects, not JSON; they sit alongside the existing JSON routes).
  State stored/validated through a tiny Redis helper.
- `user.repository.ts` — add `findByGoogleId`, `linkGoogleId`, and a
  `createGoogleUser` (or extend the existing create) path.

### Frontend units

- "Continue with Google" button component on `(auth)/login/page.tsx` and
  `(auth)/register/page.tsx` → anchors to `/api/auth/google`.
- `(auth)/google/callback/page.tsx` — parses the fragment, calls
  `setSession(tokens)`, redirects to `/dashboard`; on missing tokens →
  `/login?error=google`.
- `auth-context.tsx` — add `setSession(tokens: TokenPair)` that mirrors the
  post-login path (store refresh, set in-memory access).
- `/login` reads `?error=google` and shows an inline error.

### Tests

- Unit (`auth.service` / `auth-google.service`): three `loginWithGoogle` branches
  (found-by-googleId / linked-by-email / created), null-password login guard, and
  Google code-exchange mocked.
- Unit: `state` validation (valid / unknown / reused).
- E2E: callback page consumes a mocked fragment and lands authenticated;
  `?error=google` renders the error. (Reuses the existing dev stack; respects the
  ≤10 logins budget — Google e2e mock does not hit the password login limiter.)

---

## Feature B — Hero "Go!" → calculator with YouTube views

Frontend-only. Backend untouched.

- `hero.tsx` `handleGo` is unchanged: stash link in `sessionStorage`, dispatch
  `youboost:hero-link`, smooth-scroll to `#services`.
- `service-tiers.tsx`:
  - Add a pure helper `findYoutubeViewsTier(tiers)` → first tier with
    `service.platform === 'YOUTUBE' && service.type === 'VIEWS'`, else `null`.
  - In the `onHeroLink` handler **and** the mount effect (sessionStorage path),
    when a link arrives:
    - If a YouTube-views tier exists: `setPlatform('YOUTUBE')`, `setPage(1)`; if
      that tier is not already in the cart, `addItem(tier)`; set the link on that
      tier's cart item (reusing the existing `setTimeout(0)` settle pattern); then
      scroll the panel into view.
    - If no such tier exists: current behavior — apply link to the first
      empty-link item or store as pending, then scroll.
  - No duplicate items: if the YouTube-views tier is already in the cart, just
    fill/replace its link.

### Tests

- E2E (`home-calculator` spec): typing a link + clicking "Go!" lands on the
  calculator with a YouTube-views item in the cart, its link pre-filled, and the
  platform tab on YouTube.
- E2E fallback: a landing without a YouTube-views tier falls back to the existing
  scroll-and-pending behavior.

---

## Out of scope (YAGNI)

- Account-settings "link/unlink Google" management.
- Storing Google avatar/display name.
- Other OAuth providers.
- Changing the password-login token model (stays localStorage + in-memory).

## Multi-agent execution

- **Agent 1 — Feature A backend:** schema/migration, config, `auth-google.service`,
  `loginWithGoogle`, routes, repository, backend unit tests.
- **Agent 2 — Feature A frontend:** Google button, callback page,
  `setSession`, `?error=google`, frontend e2e. Depends on Agent 1's route
  contract (the fragment shape), which is fixed by this spec, so it can proceed in
  parallel against the documented contract.
- **Agent 3 — Feature B:** fully independent, frontend-only.

Integration/verification (tsc, eslint, unit, e2e, runtime) is run after the agents
land, before commit.
