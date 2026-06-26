# Per-Service Panel Management in Admin — Implementation Plan

> **Goal:** Let an admin attach MULTIPLE panels (providers) to one service from the admin UI — add/remove a panel, set its per-panel external service id, toggle it active. Panel ORDER stays driven by the admin-set `provider.priority` (shown read-only here), never hardcoded.

**Architecture:** A "Panels" manager per service backed by `service_provider_mappings` (already exists). New admin CRUD endpoints + a dialog on the admin services page. Priority is a property of the provider (edited on the providers page), so this UI only manages *which* panels serve the service + their external ids + active flag.

**Tech stack:** Fastify + Prisma 7 + zod (backend); Next.js + React Query + shadcn dialog (frontend). Node 22 via `/opt/nodejs`. Commit `--no-verify`. Run `tsc --noEmit` + `eslint src --quiet` + `jest` before every push (test files aren't covered by `tsc --noEmit`).

## Context

Phase 2 added `service_provider_mappings` (serviceId, providerId, externalServiceId, priority, providerCost, isActive) + failover that orders panels by `provider.priority` (desc). But there's no UI to attach >1 panel to a service — the service form picks a single provider. This plan adds that UI. The mapping's own `priority` column stays unused for ordering (provider.priority is authoritative); we don't expose it.

---

### Task 1: Repo CRUD on service_provider_mappings

**Files:**
- Modify: `src/modules/providers/service-provider-mapping.repository.ts`
- Test: extend `src/modules/providers/__tests__/service-provider-mapping.repository.integration.test.ts`

**Interfaces — add to `ServiceProviderMappingRepository`:**
- `listByServiceId(serviceId): Promise<ServicePanel[]>` where
  `ServicePanel = { id: string; providerId: string; providerName: string; providerPriority: number; providerActive: boolean; externalServiceId: string; isActive: boolean }` — ALL mappings (active+inactive), ordered by `provider.priority` desc, including the provider's name/priority/isActive for display.
- `createMapping(input: { serviceId; providerId; externalServiceId }): Promise<{ id: string }>`
- `updateMapping(id: string, data: { externalServiceId?: string; isActive?: boolean }): Promise<void>`
- `deleteMapping(id: string): Promise<void>`
- `findMappingById(id: string): Promise<{ id: string; serviceId: string } | null>`

- [ ] Write integration tests (real test DB, existing guard): create 2 mappings for a service → `listByServiceId` returns both with provider name/priority; `updateMapping` flips isActive; `deleteMapping` removes; duplicate (serviceId+providerId) `createMapping` rejects (the `@@unique` throws — assert it rejects).
- [ ] Implement with Prisma (`include: { provider: { select: { name, priority, isActive } } }` for list; `create`/`update`/`delete`/`findUnique`). Map Decimal/relations to the flat `ServicePanel`.
- [ ] Run: `TEST_DATABASE_URL=… npx jest service-provider-mapping.repository.integration` → PASS. Commit.

---

### Task 2: Admin service — panel operations

**Files:**
- Modify: `src/modules/admin/admin-services.service.ts` (+ deps: add `mappingRepo`)
- Modify: `src/modules/admin/admin.types.ts` (zod schemas)
- Modify: `src/app.ts` / `src/composition/admin-services.ts` (wire `mappingRepo`)
- Test: `src/modules/admin/__tests__/admin-services.service.test.ts` (extend)

**Interfaces — add to `AdminServicesService`:**
- `listServicePanels(serviceId): Promise<ServicePanel[]>` (404 if service missing)
- `addServicePanel(serviceId, { providerId, externalServiceId }): Promise<ServicePanel>` — validate service + provider exist + active; on duplicate provider for the service throw `ValidationError('Panel already attached','PANEL_DUPLICATE')`.
- `updateServicePanel(mappingId, { externalServiceId?, isActive? }): Promise<ServicePanel>` (404 if mapping missing)
- `removeServicePanel(mappingId): Promise<void>` (404 if missing)

**zod (admin.types.ts):**
```ts
export const adminAddPanelSchema = z.object({ providerId: z.uuid(), externalServiceId: z.string().min(1).max(255) });
export const adminUpdatePanelSchema = z.object({ externalServiceId: z.string().min(1).max(255).optional(), isActive: z.boolean().optional() });
export const adminMappingIdSchema = z.object({ mappingId: z.uuid() });
```

- [ ] Tests with a fake mappingRepo + fake providersRepo: add validates provider + rejects duplicate; update/remove resolve via findMappingById; missing → NotFoundError. Then implement. Run `npx jest admin-services.service` → PASS. Commit (incl. wiring in app/composition).

---

### Task 3: Admin routes for panels

**Files:**
- Modify: `src/modules/admin/admin.routes.ts`
- Test: `src/modules/admin/__tests__/admin.routes.test.ts` if present (else covered by service tests)

Routes (all under existing `requireAdmin`):
- `GET    /services/:serviceId/panels`  → `servicesService.listServicePanels`
- `POST   /services/:serviceId/panels`  → `addServicePanel` (validateBody `adminAddPanelSchema`)
- `PATCH  /services/panels/:mappingId`  → `updateServicePanel` (validateBody `adminUpdatePanelSchema`)
- `DELETE /services/panels/:mappingId`  → `removeServicePanel`

- [ ] Add routes mirroring the existing service routes' validate/await pattern. Run `npx tsc --noEmit && npx eslint src --quiet && npx jest src/modules/admin` → green. Commit.

---

### Task 4: Frontend API client + types + query keys

**Files:**
- Modify: `frontend/src/lib/api/admin.ts`, `frontend/src/lib/api/types.ts`, `frontend/src/lib/query-keys.ts`

- [ ] Type `AdminServicePanel { id; providerId; providerName; providerPriority; providerActive; externalServiceId; isActive }`.
- [ ] `getServicePanels(serviceId) → AdminServicePanel[]` (`GET /admin/services/:id/panels`), `addServicePanel(serviceId, { providerId, externalServiceId })`, `updateServicePanel(mappingId, { externalServiceId?, isActive? })`, `deleteServicePanel(mappingId)` — mirror existing `getAdminServices` etc.
- [ ] `queryKeys.adminServicePanels(serviceId)`.
- [ ] `npx tsc --noEmit` (frontend) green. Commit.

---

### Task 5: "Panels" dialog on the admin services page

**Files:**
- Create: `frontend/src/components/admin/service-panels-dialog.tsx`
- Modify: `frontend/src/components/admin/service-table.tsx` (add a "Panels" row action)
- Modify: `frontend/src/app/(admin)/admin/services/page.tsx` (wire the dialog open state)

- [ ] `service-table.tsx`: add a "Panels" action (icon/button) per row calling an `onManagePanels(service)` prop.
- [ ] `service-panels-dialog.tsx`: given a `service`, `useQuery(getServicePanels)`. Render a table of panels: **Provider name · Priority (read-only, from provider) · External ID · Active toggle · Remove**. Below it an "Add panel" form: provider `Select` (from `getProviders`), external service id `Input` (free text; optional: a "browse catalog" popover via `getProviderServices` like the service form — KEEP free-text as the baseline). Mutations call the Task-4 client fns + invalidate `queryKeys.adminServicePanels(serviceId)`. Show a hint: "Order is set by each provider's priority on the Providers page."
- [ ] `page.tsx`: add `const [panelsService, setPanelsService] = useState<AdminServiceResponse|null>(null)`; pass `onManagePanels={setPanelsService}` to `ServiceTable`; render `<ServicePanelsDialog service={panelsService} onOpenChange={…}/>`.
- [ ] Verify: `npx tsc --noEmit && npx eslint src --quiet && npx jest` (frontend) green. Manual/e2e: open admin services → Panels → add a second panel → it lists; remove → gone.
- [ ] Commit.

---

### Task 6: Verify + deploy + live check

- [ ] Full backend `tsc/eslint/jest` + integration on `youboost_test`; frontend `tsc/eslint/jest`.
- [ ] Push; watch pipeline (no schema change → no migration; routes + UI only).
- [ ] Live: as admin, attach a 2nd panel to "YouTube Views", confirm `service_provider_mappings` now has 2 rows; a test purchase's failover walks both (by provider priority). Detach → back to 1.

## Notes / decisions
- Priority is NOT edited here — it lives on the provider (`provider.priority`, Providers admin page). This UI shows it read-only and orders the list by it.
- External service id is free-text per panel (admin copies it from the panel's catalog); a catalog-browse popover is an optional enhancement, not required.
- No schema/migration change — `service_provider_mappings` already exists.
- The mapping's own `priority`/`providerCost` columns stay (unused for ordering / analytics) — not surfaced in this UI.
