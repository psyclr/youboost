import {
  Zap,
  Wallet,
  Eye,
  ThumbsUp,
  Share2,
  Shield,
  Clock,
  TrendingUp,
  Key,
  Webhook,
  Bell,
  RefreshCw,
} from 'lucide-react';

type IconComponent = React.ComponentType<{ className?: string }>;

// ---------------------------------------------------------------------------
// "How it works" steps
// ---------------------------------------------------------------------------

export interface GuideStep {
  step: number;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    step: 1,
    title: 'Пополни баланс',
    description:
      'Переведи USDT на сгенерированный адрес. Деньги зачисляются после подтверждения.',
    action: { label: 'Пополнить', href: '/billing/deposit' },
  },
  {
    step: 2,
    title: 'Выбери услугу',
    description:
      'В каталоге — просмотры, лайки, подписчики для всех популярных платформ. Фильтруй по площадке и типу.',
    action: { label: 'Каталог', href: '/catalog' },
  },
  {
    step: 3,
    title: 'Вставь ссылку и количество',
    description:
      'Укажи ссылку на видео или профиль и нужное количество. Цена рассчитается автоматически.',
    action: { label: 'Новый заказ', href: '/orders/new' },
  },
  {
    step: 4,
    title: 'Получи результат',
    description:
      'Заказ выполняется автоматически. Следи за прогрессом в реальном времени. Уведомления на почту и вебхуки.',
  },
];

// ---------------------------------------------------------------------------
// Services per platform
// ---------------------------------------------------------------------------

export interface ServiceBadge {
  type: string;
  label: string;
}

export interface PlatformServices {
  name: string;
  icon: IconComponent;
  iconWrapClassName: string;
  iconClassName: string;
  badges: readonly ServiceBadge[];
}

export const GUIDE_PLATFORMS: readonly PlatformServices[] = [
  {
    name: 'YouTube',
    icon: Eye,
    iconWrapClassName: 'w-8 h-8 rounded bg-red-500/10 flex items-center justify-center',
    iconClassName: 'h-4 w-4 text-red-500',
    badges: [
      { type: 'VIEWS', label: 'Просмотры' },
      { type: 'SUBSCRIBERS', label: 'Подписчики' },
      { type: 'LIKES', label: 'Лайки' },
      { type: 'COMMENTS', label: 'Комментарии' },
    ],
  },
  {
    name: 'Instagram',
    icon: ThumbsUp,
    iconWrapClassName: 'w-8 h-8 rounded bg-pink-500/10 flex items-center justify-center',
    iconClassName: 'h-4 w-4 text-pink-500',
    badges: [
      { type: 'LIKES', label: 'Лайки' },
      { type: 'SUBSCRIBERS', label: 'Подписчики' },
      { type: 'VIEWS', label: 'Просмотры' },
      { type: 'COMMENTS', label: 'Комментарии' },
    ],
  },
  {
    name: 'TikTok',
    icon: TrendingUp,
    iconWrapClassName: 'w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center',
    iconClassName: 'h-4 w-4 text-cyan-500',
    badges: [
      { type: 'VIEWS', label: 'Просмотры' },
      { type: 'LIKES', label: 'Лайки' },
      { type: 'SUBSCRIBERS', label: 'Подписчики' },
      { type: 'SHARES', label: 'Репосты' },
    ],
  },
  {
    name: 'Twitter / Facebook',
    icon: Share2,
    iconWrapClassName: 'w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center',
    iconClassName: 'h-4 w-4 text-blue-500',
    badges: [
      { type: 'LIKES', label: 'Лайки' },
      { type: 'SUBSCRIBERS', label: 'Подписчики' },
      { type: 'SHARES', label: 'Репосты' },
      { type: 'VIEWS', label: 'Просмотры' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Pricing / developer feature cards
// ---------------------------------------------------------------------------

export interface FeatureItem {
  icon: IconComponent;
  title: string;
  description: string;
}

export const GUIDE_PRICING_FEATURES: readonly FeatureItem[] = [
  {
    icon: Wallet,
    title: 'Оплата за результат',
    description:
      'Деньги замораживаются при заказе и списываются только после выполнения. Если заказ провален — полный возврат.',
  },
  {
    icon: RefreshCw,
    title: 'Частичное выполнение',
    description:
      'Если выполнено 60% — заплатишь только за 60%. Остаток вернётся на баланс автоматически.',
  },
  {
    icon: Shield,
    title: 'Полная прозрачность',
    description:
      'Каждая транзакция записана в истории. Видно баланс до/после, тип операции и к какому заказу относится.',
  },
];

export const GUIDE_DEVELOPER_FEATURES: readonly FeatureItem[] = [
  {
    icon: Key,
    title: 'API-ключи',
    description:
      'Управляй заказами из своего кода. Формат: yb_..., три тарифа rate-limit: 100, 500, 2000 запросов в минуту.',
  },
  {
    icon: Webhook,
    title: 'Вебхуки',
    description:
      'Получай POST-уведомления на свой сервер при изменении статуса. HMAC-SHA256 подпись, 3 повтора при сбое.',
  },
  {
    icon: Bell,
    title: 'Email-уведомления',
    description:
      'Автоматические уведомления на почту: заказ создан, выполнен, провален, отменён.',
  },
  {
    icon: Clock,
    title: 'Реальное время',
    description:
      'Статус заказа обновляется каждые 30 секунд. Отслеживай прогресс на странице заказа.',
  },
];

// ---------------------------------------------------------------------------
// Wallet stats
// ---------------------------------------------------------------------------

export interface WalletStat {
  value: string;
  valueClassName?: string;
  label: string;
  hint: string;
}

export const GUIDE_WALLET_STATS: readonly WalletStat[] = [
  { value: '$50', label: 'Balance', hint: 'Всего на счету' },
  { value: '$10', valueClassName: 'text-yellow-500', label: 'Frozen', hint: 'Заморожено под заказы' },
  { value: '$40', valueClassName: 'text-green-500', label: 'Available', hint: 'Можно тратить' },
];

// ---------------------------------------------------------------------------
// Order statuses table
// ---------------------------------------------------------------------------

export interface OrderStatusRow {
  status: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  meaning: string;
  money: string;
}

export const GUIDE_ORDER_STATUSES: readonly OrderStatusRow[] = [
  { status: 'PENDING', variant: 'outline', meaning: 'Заказ создан, ждёт отправки', money: 'Заморожены' },
  { status: 'PROCESSING', variant: 'secondary', meaning: 'Выполняется', money: 'Заморожены' },
  { status: 'COMPLETED', variant: 'default', meaning: 'Готово', money: 'Списаны' },
  { status: 'PARTIAL', variant: 'secondary', meaning: 'Частично выполнен', money: 'Частично списаны' },
  { status: 'FAILED', variant: 'destructive', meaning: 'Не удалось', money: 'Возвращены' },
  { status: 'CANCELLED', variant: 'destructive', meaning: 'Отменён', money: 'Возвращены' },
];

// ---------------------------------------------------------------------------
// Security points
// ---------------------------------------------------------------------------

export interface SecurityPoint {
  title: string;
  description: string;
}

export const GUIDE_SECURITY_POINTS: readonly SecurityPoint[] = [
  {
    title: 'Пароли зашифрованы',
    description: 'bcrypt хеширование, пароль никогда не хранится в открытом виде',
  },
  {
    title: 'API-ключи захешированы',
    description: 'SHA256 — даже при утечке базы ключ не восстановить',
  },
  {
    title: 'Вебхуки подписаны',
    description: 'HMAC-SHA256 — всегда проверяй подпись на своей стороне',
  },
  {
    title: 'Полный аудит',
    description: 'Каждая транзакция записана с балансом до и после',
  },
];

// ---------------------------------------------------------------------------
// API usage example (raw code block)
// ---------------------------------------------------------------------------

export const GUIDE_API_EXAMPLE = `// Авторизация
Authorization: Bearer yb_your_api_key_here

// Создание заказа
POST /orders
{
  "serviceId": "uuid",
  "link": "https://youtube.com/watch?v=...",
  "quantity": 5000
}

// Вебхук на ваш сервер
{
  "event": "order.completed",
  "data": { "orderId": "abc", "status": "COMPLETED" },
  "timestamp": "2026-02-26T12:00:00Z"
}`;

// Hero icon re-exported so the page renders identically without re-importing here.
export const GUIDE_HERO_ICON = Zap;
