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
