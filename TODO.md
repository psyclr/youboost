# TODO

## Лендинг (первая страница) — целевой вид

Сделать главную страницу в таком виде (макет прислан 2026-06-16):

**Hero (тёмная секция, на всю ширину):**
- Заголовок: «Promote your YouTube video in one minute»
- Подзаголовок: «Use the instant calculator, pick a quantity and launch a guest
  checkout without opening a dashboard first.»
- Поле ввода «Enter the link or title of the video» + красная кнопка **Go!**
- Строка метрик под полем: `1 min` guest checkout · `$4+` starter orders ·
  `24/7` order tracking · `Auto` account setup
- Справа — 3D-рендер красной YouTube-кнопки (play) на чёрном фоне

**Секция «Instant results without registration» (светлая):**
- Подзаголовок: «Boost your account in just a few clicks»
- Слева: табы платформ (All / YouTube / Instagram / TikTok / Twitter / Facebook),
  сетка сервис-карточек 2 колонки (иконка, название, описание, цена `$X / 1000`,
  `Min: .. — Max: ..`, кнопка **Pay**), пагинация 1/2/3; справа сверху — поиск
  «Enter a name to search» + **Search**
- Справа: панель корзины — позиции (название, цена, кол-во, ссылка, удалить/свернуть),
  поле **Email**, переключатель оплаты **Card / Crypto**, большая кнопка
  **Pay $X.XX**, мелкий дисклеймер про гостевой чекаут (аккаунт создаётся
  автоматически после оплаты).

Компоненты уже существуют (`hero.tsx`, `service-tiers.tsx`, `order-cart.tsx`,
`cart-item.tsx`) — задача свести их в этот лэйаут на главной. Уточнить у владельца,
отличается ли это от текущего вида и что именно поменять.

## Аналитика — Yandex.Metrika (counter id 109942271)

Подключить счётчик Яндекс.Метрики на сайт. Параметры init: `ssr:true`,
`webvisor:true`, `clickmap:true`, `ecommerce:"dataLayer"`, `accurateTrackBounce:true`,
`trackLinks:true`, плюс `referrer`/`url`.

Подход для Next.js (App Router): грузить через `next/script` (strategy
`afterInteractive`) в корневом `layout.tsx`, либо проверить `@next/third-parties`
на поддержку Yandex Metrica. `<noscript>`-пиксель тоже добавить.

Важно (ecommerce через dataLayer): раз включаем `ecommerce:"dataLayer"`, имеет смысл
пушить ecommerce-события на ключевых шагах денежного флоу (просмотр услуги,
добавление в корзину, purchase после оплаты) — иначе e-commerce отчёты будут пустыми.

ВНИМАНИЕ: в присланном сниппете опечатки копипасты — корректные строки:
`m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};`
(в оригинале потерялись `||`). Брать официальный сниппет из кабинета Метрики, не
присланный.

## CLAUDE.md — привести в соответствие с проектом (позже)

Пройтись по CLAUDE.md и обновить под текущее состояние (можно через скилл
claude-md-improver). Что заведомо устарело/изменилось:
- «No CI: none wanted» — больше неактуально: строим деплой-пайплайн на базе Claude
  Code разработки; есть изолированный Docker e2e-стек (docker-compose.test.yml +
  scripts/e2e-stack.sh) — основа CI.
- Тест-окружения: три уровня (mocked UI → dev/youboost_dev; real e2e → Docker-стек;
  DB-интеграция → youboost_test) — уже добавил в E2E-раздел, свериться, что цельно.
- Лимит логинов теперь env-настраиваемый (LOGIN_RATE_LIMIT_MAX), dev поднимает его;
  старые формулировки про «<=10 логинов» пересмотреть.
- Появились seam'ы: PAYMENTS_FAKE, NEXT_DIST_DIR, SEED_E2E — описать назначение.
- БД: прод и dev делят youboost_dev (любая запись = прод-данные); есть youboost_test
  и эфемерная БД Docker-стека. Сверить с реальностью.
- Провайдер-движок: Perfect Panel / совместимый (smm-api-client key+action).
