# YouBoost & Blog Engine — Roadmap

## Blog Engine SaaS

Blog Engine — отдельный продукт: автоматический SEO-блог на домене клиента.
Клиент регистрируется, описывает бизнес, ставит CNAME — блог живёт сам.

### Реализовано
- [x] Технический SEO youboost: sitemap, robots, metadataBase, JSON-LD, canonical URLs
- [x] Blog Engine scaffold: Fastify app, Prisma schema (отдельная база `blog_engine_dev`)
- [x] Sites CRUD: создание сайта, API key, subdomain, кастомный домен + DNS verify
- [x] Posts CRUD: создание, редактирование, publish, ISR revalidation webhook
- [x] Public API: `GET /v1/posts`, `GET /v1/posts/:slug` (по API key или Host header)
- [x] Seed: youboost.io как первый клиент

### Итерация 3 — youboost /blog интеграция
- [ ] `frontend/src/app/blog/page.tsx` — список постов (fetch из blog-engine API)
- [ ] `frontend/src/app/blog/[slug]/page.tsx` — статья + Article JSON-LD
- [ ] `frontend/src/app/api/revalidate/blog/route.ts` — ISR webhook handler
- [ ] Env vars: `BLOG_ENGINE_URL`, `BLOG_ENGINE_API_KEY`, `BLOG_REVALIDATE_SECRET`

### Итерация 4 — AI Pipeline
- [ ] BullMQ queue: `blog:generate`, `blog:keywords`
- [ ] Claude API: генерация статьи по ключевому слову
- [ ] SEO валидатор: title 50-60 chars, description 150-160, keyword density 1-2%
- [ ] Keyword suggestions: Claude генерирует N ключевых слов по тематике сайта
- [ ] Unsplash: автоматическая обложка (кэш 24ч в Redis)
- [ ] Cron расписание: `0 10 * * 2,5` (вт/пт, 10:00 UTC)
- [ ] Usage tracking: BlogUsage per site per month
- [ ] Plan limits: FREE=4 поста/мес, STARTER=20, PRO=unlimited

### Итерация 5 — Blog Engine hosted rendering
- [ ] `blog-engine/frontend/` Next.js app
- [ ] Multi-tenant routing по Host header
- [ ] Страницы: список `/`, статья `/[slug]`
- [ ] Per-site sitemap.xml и robots.txt
- [ ] Per-site брендинг (primaryColor, logo, font)
- [ ] Caddy + on-demand TLS для кастомных доменов

### Итерация 6 — SaaS Dashboard (blog-engine adminка)
- [ ] Регистрация и логин (JWT, отдельный от youboost)
- [ ] Создать сайт: форма → subdomain → DNS инструкции
- [ ] Статус верификации домена
- [ ] Список постов (approve/edit/reject черновиков)
- [ ] Markdown редактор + preview
- [ ] Keyword dashboard (список, difficulty, used/unused)
- [ ] Analytics: просмотры по постам, avg position (GSC опционально)
- [ ] Usage/billing view: посты и токены за месяц

### Итерация 7 — Auth в blog-engine + API key management
- [ ] Отдельная `BlogUser` таблица в blog_engine_dev
- [ ] JWT auth для dashboard routes
- [ ] API key ротация
- [ ] Webhook management (клиент настраивает свой URL для уведомлений)

### Будущее (после запуска)
- [ ] Landing page blog-engine.io для продажи
- [ ] Stripe биллинг: FREE / STARTER $29/мес / PRO $99/мес / AGENCY $299/мес
- [ ] WordPress plugin (JS snippet embed)
- [ ] DataForSEO интеграция (реальные search volumes)
- [ ] Google Search Console API (позиции в поиске)
- [ ] Internal linking автоматически (AI находит перекрёстные ссылки)
- [ ] Multi-language: один сайт → статьи на RU + EN

---

## YouBoost SMM Panel

### В работе
- [x] Лендинги (marketing pages) с SEO
- [x] Каталог услуг, заказы, биллинг
- [x] Реферальная программа, купоны
- [x] Поддержка, трекинг ссылок

### Следующие фичи
- [ ] Каталог услуг (SEO-страницы `/services/youtube` и т.д.) — публичный API catalog
- [ ] Публичные SEO-страницы услуг с JSON-LD ItemList
- [ ] Youboost admin: кнопка "Включить блог" → создаёт BlogSite в blog-engine
