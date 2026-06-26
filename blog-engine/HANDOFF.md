# Blog Engine — Handoff для следующей сессии

## Что уже сделано (ветка `claude/funny-davinci-mf7bbz`)

### Итерация 1 — Технический SEO youboost-frontend ✅
- `frontend/src/app/robots.ts`, `sitemap.ts`
- `frontend/src/lib/structured-data.ts` (Organization/WebSite/Article JSON-LD)
- `frontend/src/app/layout.tsx` — metadataBase, OG, Twitter card
- `frontend/src/app/page.tsx` — canonical, JSON-LD скрипты
- `frontend/src/components/marketing/site-header.tsx` — ссылка Blog в навигации

### Итерация 2 — blog-engine scaffold ✅
- `blog-engine/` — отдельный Fastify-сервис, своя Prisma схема, своя база `blog_engine_dev`
- `blog-engine/prisma/schema.prisma` — BlogSite, BlogPost, BlogKeyword, BlogUsage + BYOS поля
- `blog-engine/src/` — modules: sites (CRUD + DNS verify), posts (CRUD + ISR webhook)
- `blog-engine/src/ai/llm-client.ts` — BYOS: провайдер-агностичный LlmClient (Anthropic + OpenAI)
- `blog-engine/src/modules/sites/` — GET/PATCH `/:id/llm` для настройки провайдера
- `blog-engine/prisma/seed.ts` — youboost.io как первый BlogSite (PRO, SMM топики)

## Первый шаг: поднять базу и сгенерировать клиент

```bash
# На сервере с запущенным Postgres
psql -U youboost -c "CREATE DATABASE blog_engine_dev;"

cd blog-engine
npm install
npx prisma migrate dev --name init   # создаёт таблицы в blog_engine_dev
npx prisma generate                  # генерирует src/generated/prisma/
npm run db:seed                      # создаёт youboost.io как первый BlogSite, выводит API key

# Сохрани apiKey из вывода seed — он нужен для следующего шага
# BLOG_ENGINE_API_KEY=sk_live_youboost_xxxxxxxx
```

## Итерация 3 — youboost /blog страницы

Добавить в `frontend/` (youboost Next.js):

### 1. Env vars в `frontend/.env.local`
```
BLOG_ENGINE_URL=http://localhost:3200
BLOG_ENGINE_API_KEY=sk_live_youboost_xxxxxxxx   # из seed
BLOG_REVALIDATE_SECRET=change-me
```

### 2. `frontend/src/app/blog/page.tsx`
Список постов — fetch `GET /v1/posts` с Bearer токеном, `revalidate: 3600`.
Показывать: title, description, publishedAt, coverImageUrl, slug → `/blog/[slug]`.

### 3. `frontend/src/app/blog/[slug]/page.tsx`
Статья — fetch `GET /v1/posts/:slug`.
- `generateMetadata` — title, description, OG image (coverImageUrl), canonical
- Article JSON-LD из `structured-data.ts` (`articleJsonLd`)
- Рендер `content` как Markdown (пакет `react-markdown` или `next-mdx-remote`)

### 4. `frontend/src/app/api/revalidate/blog/route.ts`
ISR webhook — blog-engine вызывает его при публикации поста:
```ts
// POST с заголовком X-Revalidate-Secret
// Вызывает revalidatePath('/blog') и revalidatePath(`/blog/${slug}`)
```

### 5. Обновить `frontend/src/app/sitemap.ts`
Уже есть заглушка для blog slugs — раскомментировать/дописать fetch к `GET /v1/posts/sitemap`
(маршрут уже реализован в blog-engine, возвращает `[{ slug, updatedAt }]`).

## Итерация 4 — AI Pipeline

В `blog-engine/src/`:

### Зависимости
```bash
npm install bullmq ioredis node-cron
```

### Структура
```
src/
  ai/
    llm-client.ts       ✅ готово
    content-generator.ts  ← генерация статьи по ключевому слову
    keyword-suggester.ts  ← предложение ключевых слов по тематике сайта
  jobs/
    generate.job.ts     ← BullMQ worker: blog:generate
    keywords.job.ts     ← BullMQ worker: blog:keywords
    cron.ts             ← расписание: '0 10 * * 2,5' (вт/пт 10:00 UTC)
```

### content-generator.ts
Промпт для Claude/OpenAI:
- system: роль SEO-копирайтера, язык сайта, тон, бизнес-описание
- user: целевое ключевое слово, вторичные ключевые слова
- Выход: `{ title, description, content (markdown), secondaryKeywords }`
- SEO валидация: title 50-60 chars, description 150-160, keyword density 1-2%

### keyword-suggester.ts
Промпт: по `topics` и `businessDescription` сгенерировать N ключевых слов.
Сохранять в `BlogKeyword` с `source: AI`.

### Plan limits (в generate.job.ts)
```
FREE:    4 posts/month
STARTER: 20 posts/month
PRO:     unlimited
AGENCY:  unlimited
```
Проверять `BlogUsage` перед генерацией, инкрементить после.

### Unsplash обложки
`GET https://api.unsplash.com/search/photos?query={keyword}&per_page=1`
Сохранять URL в `coverImageUrl`. Кэш в Redis 24ч по ключу `unsplash:{keyword}`.

### Ручной trigger
`POST /sites/:id/generate` — уже есть роут в sites.routes, нужно подключить к BullMQ.

## Архитектурные константы

| Параметр | Значение |
|---|---|
| Blog-engine port | 3200 |
| Blog-engine Redis | localhost:6380 (отдельный от youboost 6379) |
| Blog-engine DB | blog_engine_dev (отдельная от youboost_dev) |
| API auth | `Authorization: Bearer sk_live_xxx` |
| ISR webhook | POST youboost `/api/revalidate/blog` при publish |
| Граница | blog-engine НЕ импортирует из youboost/src |

## Важно

- Все модели блога живут ТОЛЬКО в `blog-engine/prisma/schema.prisma` — в `youboost/prisma/schema.prisma` их нет и не должно быть
- `llmCredential` в ответах API никогда не возвращается (только `hasCredential: boolean`)
- `autoPublish: false` по умолчанию — все посты идут в DRAFT, нужен approve
