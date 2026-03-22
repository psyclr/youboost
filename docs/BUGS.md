# YouBoost — Bugs & Missing Features (Testing 2026-03-13)

## Found during manual Docker deployment testing

### 1. External Service ID — manual input only

- **Where**: Admin > Services > Create/Edit Service
- **Problem**: External Service ID field requires manual text input. The "Browse" button works only if the provider has a real API key configured (seed data has a placeholder key, so decryption fails).
- **Expected**: Proper mapping/autocomplete from provider's service catalog. When browsing fails, show a clearer fallback (e.g. cached list, or direct ID lookup).
- **Fix**: Backend catches decryption errors, returns clear message. Frontend shows inline error in Browse dialog with fallback instructions. Manual ID input always available.
- **Priority**: Medium
- **Status**: FIXED

### 2. Referral Links — repurposed as Admin Tracking Links

- **Where**: Admin sidebar > Tracking
- **Problem**: Original referral bonus system not needed for this project. Instead, admins need tracking links to monitor which ad campaigns bring registrations.
- **Fix**: New `tracking` module: admin creates named links (e.g. `tg_banner_march`), sees registration count per link. Uses existing `user.referralCode` field. Old referral module left as-is but hidden from users.
- **Priority**: P1
- **Status**: FIXED
- **Files**: `src/modules/tracking/`, `frontend/src/app/(admin)/admin/referrals/page.tsx`, `frontend/src/lib/api/tracking.ts`

### 3. Payment Methods — admin configuration missing (IMPORTANT)

- **Where**: Admin panel — no payment settings page
- **Problem**: Payment gateways (Stripe keys, crypto settings) are hardcoded in env vars. Admin cannot configure payment methods, enable/disable gateways, or set fees from the UI.
- **Expected**: Admin panel page to:
  - Enable/disable payment methods (Stripe, crypto, etc.)
  - Configure API keys and webhook secrets per gateway
  - Set deposit fees, minimum amounts
  - View payment gateway status/health
- **Priority**: P0 — big separate feature
- **Files**: Need new module `src/modules/payment-settings/` + admin frontend page

### 4. Drip-feed — full admin management

- **Where**: Admin panel > Orders
- **Problem**: Drip-feed orders existed but admin had no visibility, filtering, or control (pause/resume).
- **Fix**:
  - Schema: added `dripFeedPausedAt` field to Order model (nullable timestamp — NULL = active, NOT NULL = paused)
  - Repository: `findDripFeedOrdersDue()` skips paused orders, new `pauseDripFeed()`/`resumeDripFeed()` methods, `isDripFeed` filter in `findAllOrders()`
  - Admin API: `POST /admin/orders/:id/pause-drip-feed`, `POST /admin/orders/:id/resume-drip-feed` with validation
  - Worker: guard check `if (order.dripFeedPausedAt) return` in `processDripFeedRun()`
  - Frontend: "Drip-feed only" filter (Switch), "(paused)" indicator in drip-feed column, Pause/Resume action buttons
- **Priority**: P1
- **Status**: FIXED
- **Files**: `prisma/schema.prisma`, `src/modules/orders/orders.repository.ts`, `src/modules/orders/workers/drip-feed.worker.ts`, `src/modules/admin/admin-orders.service.ts`, `src/modules/admin/admin.routes.ts`, `src/modules/admin/admin.types.ts`, `frontend/src/app/(admin)/admin/orders/page.tsx`, `frontend/src/lib/api/admin.ts`

### 5. Provider seed data — fake API key causes Browse to fail

- **Where**: Admin > Services > Browse Provider Services
- **Problem**: Seed provider has `apiKeyEncrypted: 'encrypted_placeholder_key'` which fails decryption, causing 500 error when browsing services
- **Fix**: Backend `fetchProviderServices()` catches decryption errors and returns "Provider API key is not configured or invalid" (422 instead of 500). Seed data unchanged (dev-only, not used in production).
- **Priority**: Low (dev/testing only)
- **Status**: FIXED
- **Files**: `src/modules/providers/providers.service.ts`

### 6. Support ticket — Priority selector exposed to users

- **Where**: Dashboard > Support > New Ticket
- **Problem**: Users can set ticket priority (LOW/MEDIUM/HIGH/URGENT). Priority should be admin-controlled.
- **Fix**: Remove Priority select from user form, default to LOW
- **Priority**: Low
- **Status**: FIXED

### 7. Drip-feed "Number of Runs" — validation error

- **Where**: Dashboard > Orders > New Order > Drip-feed toggle
- **Problem**: `<Input type="number">` passes string via onChange, Zod expects number. Submitting drip-feed order fails validation.
- **Fix**: Use `e.target.valueAsNumber` in onChange handler
- **Priority**: Medium
- **Status**: FIXED

### 8. API Keys link in user sidebar — feature not ready

- **Where**: Dashboard sidebar
- **Problem**: API Keys page linked in sidebar but feature is not user-facing yet
- **Fix**: Remove from user sidebar
- **Priority**: Low
- **Status**: FIXED

### 9. Webhooks link in user sidebar — feature not ready

- **Where**: Dashboard sidebar
- **Problem**: Webhooks page linked in sidebar but feature is not user-facing yet
- **Fix**: Remove from user sidebar
- **Priority**: Low
- **Status**: FIXED

### 10. Referrals in user sidebar — feature incomplete

- **Where**: Dashboard sidebar
- **Problem**: Referral page exists but feature is minimal/incomplete, confusing for users
- **Fix**: Move to admin-only sidebar until feature is complete
- **Priority**: Low
- **Status**: FIXED

### 11. Ad banner placeholder missing

- **Where**: Billing page
- **Problem**: No space reserved for advertisements/promotions
- **Fix**: Add placeholder banner on billing page
- **Priority**: Low
- **Status**: FIXED

### 12. Referrals missing from admin sidebar

- **Where**: Admin sidebar
- **Problem**: No Referrals link in admin navigation
- **Fix**: Add Referrals to admin sidebar nav items
- **Priority**: Low
- **Status**: FIXED

---

## Previously fixed issues (this session)

- Admin login redirect (always went to /dashboard instead of /admin) — FIXED
- Provider UUID validation (Zod v4 strict UUID) — FIXED
- Docker deployment (SSL certs, Prisma generate, env vars, frontend proxy) — FIXED
- Browse provider services error handling (shows error UI instead of crash) — FIXED
