# Design: one-click "connect your own LLM provider" (per BlogSite)

> Forward design (not yet implemented). Builds on the existing BYOS scaffolding:
> `BlogSite.llmProvider|llmCredential|llmModel`, `GET/PATCH /sites/:id/llm`,
> `getLlmSettings` (returns `hasCredential`, never the secret), and
> `createLlmClient(site, config)` in `src/ai/llm-client.ts`.

## Goal

A site owner connects the LLM that generates their posts in one click from the
admin — either by **API key** (OpenAI, Anthropic) or by **ChatGPT subscription**
(OpenAI Codex, no per-token key). Each site is isolated.

## Core idea — split provider from auth mode

Today the model is provider-only (`OPENAI` / `ANTHROPIC`) and assumes an API key.
Separate the two concerns:

- **provider**: `OPENAI` | `ANTHROPIC` | (future: `GOOGLE`…)
- **authMode**: `API_KEY` | `SUBSCRIPTION`
  - `API_KEY` → key pasted once, encrypted at rest in `llmCredential`.
  - `SUBSCRIPTION` → ChatGPT login via Codex; **no secret stored** — auth lives in
    a per-site Codex config dir that Codex refreshes itself.

## Schema (future migration)

On `BlogSite`:

- `llmAuthMode  LlmAuthMode @default(API_KEY)` (new enum `API_KEY | SUBSCRIPTION`)
- keep `llmCredential` (now actually AES-256-GCM encrypted — finishes the
  `decryptCredential` TODO in llm-client.ts; reuse youboost's
  `createEncryptionService` pattern)
- `llmConnected Boolean @default(false)`, `llmConnectedAt DateTime?`
- subscription isolation is a **derived path**, not a column:
  `CODEX_HOME = $BLOG_DATA/codex/<siteId>` (so two sites' ChatGPT logins never mix).

## API (blog-engine, scoped to a site)

- `GET  /sites/:id/llm` → `{ provider, authMode, model, connected }` (no secret).
- `POST /sites/:id/llm/connect`:
  - `API_KEY`: `{ provider, apiKey, model? }` → validate with a tiny test call →
    encrypt → store → `connected=true`.
  - `SUBSCRIPTION`: `{ provider: 'OPENAI' }` → spawn `codex login --device-auth`
    with `CODEX_HOME=<site dir>` → return `{ verificationUrl, userCode, expiresIn }`.
- `GET  /sites/:id/llm/connect/status` → polled by the UI; flips to `connected`
  once the site's `auth.json` exists.
- `POST /sites/:id/llm/disconnect` → clear `llmCredential` / wipe the site's Codex
  dir → `connected=false`.
- Rate-limit connect attempts; never log keys/tokens.

## llm-client dispatch

`createLlmClient(site)` switches on `authMode`:

- `SUBSCRIPTION` → **Codex client**: spawns
  `codex exec "<prompt>" --model <m> --output-schema post.schema.json -o out.json
 --ephemeral --skip-git-repo-check --ignore-user-config --sandbox read-only`
  with `CODEX_HOME=<site dir>`, parses the JSON. (Default provider per the product
  decision: OpenAI/Codex.)
- `API_KEY` → existing SDK clients (OpenAI / Anthropic), key decrypted from
  `llmCredential` or the global fallback.

## Admin UI (the "one click")

A single "AI provider" card per site:

- Status line: `Connected — OpenAI · ChatGPT subscription` or `Not connected`.
- Provider picker + one primary button:
  - **Connect with ChatGPT** → device-code modal (shows code + link, auto-polls,
    flips to Connected). This is the headline one-click path.
  - **Connect OpenAI API key** / **Connect Anthropic** → small modal: paste key →
    Connect (validated server-side).
  - **Disconnect** when connected; optional model dropdown.
- Lives in whatever admin owns BlogSites (blog-engine admin; youboost's own site
  uses the same endpoints).

## Security

- `llmCredential` AES-256-GCM encrypted at rest; responses expose only `connected`
  / `hasCredential`.
- Per-site `CODEX_HOME` dirs `chmod 700`, outside the repo, isolated per tenant.
- Validate keys before saving; rate-limit connect; redact secrets from logs.

## Pricing / economics (the point of the feature)

Two billing modes per site, driven entirely by whether a provider is connected:

| Mode        | Price      | LLM auth                                           | Who pays the LLM |
| ----------- | ---------- | -------------------------------------------------- | ---------------- |
| **BYOS**    | **$15/mo** | site's own key or ChatGPT subscription (connected) | the customer     |
| **Managed** | **$25/mo** | our org provider (global Codex/ChatGPT or key)     | us               |

- Connecting a provider **is** the toggle from Managed → BYOS. Disconnecting flips
  back to Managed. So `llmConnected` is the billing discriminator, not a separate flag.
- **Managed** sites run on our global `config` provider (our ChatGPT/Codex auth or
  API key) and MUST be metered against the plan's `BlogUsage` quota — we eat the cost,
  so generation is capped per plan. **BYOS** sites are not metered by us (they pay
  their own LLM); we only enforce the post-count plan limit.
- The admin card should surface the delta: e.g. "Connect your own provider and pay
  $15/mo instead of $25" — making the one-click connect a direct save.
- Billing computes the effective monthly price from `llmConnected` (+ base plan).

## Why this shape

The provider×authMode split means adding a new provider (Google, etc.) or a new
subscription type is a config row + a client function — no new plumbing. The
one-click device-code flow is the same shape any future OAuth provider would use.
