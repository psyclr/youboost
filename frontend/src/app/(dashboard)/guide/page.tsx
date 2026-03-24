'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Zap,
  Wallet,
  Eye,
  ThumbsUp,
  UserPlus,
  MessageCircle,
  Share2,
  ArrowRight,
  Shield,
  Clock,
  TrendingUp,
  Key,
  Webhook,
  Bell,
  CheckCircle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

function FeatureCard({
  icon: Icon,
  title,
  description,
}: Readonly<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}>): React.ReactElement {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StepCard({
  step,
  title,
  description,
  action,
}: Readonly<{
  step: number;
  title: string;
  description: string;
  action?: { label: string; href: string };
}>): React.ReactElement {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
          {step}
        </div>
        {step < 4 && <div className="w-px h-8 bg-border mx-auto mt-2" />}
      </div>
      <div className="pb-8">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-muted-foreground mt-1">{description}</p>
        {action && (
          <Link href={action.href}>
            <Button variant="outline" size="sm" className="mt-3">
              {action.label}
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function ServiceTypeIcon({ type }: Readonly<{ type: string }>): React.ReactElement {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    VIEWS: Eye,
    LIKES: ThumbsUp,
    SUBSCRIBERS: UserPlus,
    COMMENTS: MessageCircle,
    SHARES: Share2,
  };
  const Icon = icons[type] ?? Eye;
  return <Icon className="h-4 w-4" />;
}

export default function GuidePage(): React.ReactElement {
  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center space-y-4 pt-4">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Zap className="h-8 w-8 text-primary" />
          <span className="text-3xl font-bold">youboost</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Продвигай контент в соцсетях</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Просмотры, лайки, подписчики — для YouTube, Instagram, TikTok и других платформ. Быстро,
          надёжно, с полной прозрачностью.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/catalog">
            <Button size="lg">
              Открыть каталог
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href="/orders/new">
            <Button variant="outline" size="lg">
              Создать заказ
            </Button>
          </Link>
        </div>
      </div>

      <Separator />

      {/* How it works */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Как это работает</h2>
          <p className="text-muted-foreground mt-1">4 шага от регистрации до результата</p>
        </div>

        <div className="max-w-lg mx-auto">
          <StepCard
            step={1}
            title="Пополни баланс"
            description="Переведи USDT на сгенерированный адрес. Деньги зачисляются после подтверждения."
            action={{ label: 'Пополнить', href: '/billing/deposit' }}
          />
          <StepCard
            step={2}
            title="Выбери услугу"
            description="В каталоге — просмотры, лайки, подписчики для всех популярных платформ. Фильтруй по площадке и типу."
            action={{ label: 'Каталог', href: '/catalog' }}
          />
          <StepCard
            step={3}
            title="Вставь ссылку и количество"
            description="Укажи ссылку на видео или профиль и нужное количество. Цена рассчитается автоматически."
            action={{ label: 'Новый заказ', href: '/orders/new' }}
          />
          <StepCard
            step={4}
            title="Получи результат"
            description="Заказ выполняется автоматически. Следи за прогрессом в реальном времени. Уведомления на почту и вебхуки."
          />
        </div>
      </div>

      <Separator />

      {/* Services */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Что мы предлагаем</h2>
          <p className="text-muted-foreground mt-1">Услуги для всех популярных платформ</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center">
                  <Eye className="h-4 w-4 text-red-500" />
                </div>
                <span className="font-semibold">YouTube</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  <ServiceTypeIcon type="VIEWS" />
                  <span className="ml-1">Просмотры</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="SUBSCRIBERS" />
                  <span className="ml-1">Подписчики</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="LIKES" />
                  <span className="ml-1">Лайки</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="COMMENTS" />
                  <span className="ml-1">Комментарии</span>
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded bg-pink-500/10 flex items-center justify-center">
                  <ThumbsUp className="h-4 w-4 text-pink-500" />
                </div>
                <span className="font-semibold">Instagram</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  <ServiceTypeIcon type="LIKES" />
                  <span className="ml-1">Лайки</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="SUBSCRIBERS" />
                  <span className="ml-1">Подписчики</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="VIEWS" />
                  <span className="ml-1">Просмотры</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="COMMENTS" />
                  <span className="ml-1">Комментарии</span>
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-cyan-500" />
                </div>
                <span className="font-semibold">TikTok</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  <ServiceTypeIcon type="VIEWS" />
                  <span className="ml-1">Просмотры</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="LIKES" />
                  <span className="ml-1">Лайки</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="SUBSCRIBERS" />
                  <span className="ml-1">Подписчики</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="SHARES" />
                  <span className="ml-1">Репосты</span>
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center">
                  <Share2 className="h-4 w-4 text-blue-500" />
                </div>
                <span className="font-semibold">Twitter / Facebook</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  <ServiceTypeIcon type="LIKES" />
                  <span className="ml-1">Лайки</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="SUBSCRIBERS" />
                  <span className="ml-1">Подписчики</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="SHARES" />
                  <span className="ml-1">Репосты</span>
                </Badge>
                <Badge variant="outline">
                  <ServiceTypeIcon type="VIEWS" />
                  <span className="ml-1">Просмотры</span>
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Pricing */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Прозрачное ценообразование</h2>
          <p className="text-muted-foreground mt-1">Платишь только за то, что получил</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FeatureCard
            icon={Wallet}
            title="Оплата за результат"
            description="Деньги замораживаются при заказе и списываются только после выполнения. Если заказ провален — полный возврат."
          />
          <FeatureCard
            icon={RefreshCw}
            title="Частичное выполнение"
            description="Если выполнено 60% — заплатишь только за 60%. Остаток вернётся на баланс автоматически."
          />
          <FeatureCard
            icon={Shield}
            title="Полная прозрачность"
            description="Каждая транзакция записана в истории. Видно баланс до/после, тип операции и к какому заказу относится."
          />
        </div>
      </div>

      <Separator />

      {/* Wallet explanation */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Как работает кошелёк</h2>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-6 text-center mb-6">
              <div>
                <p className="text-3xl font-bold">$50</p>
                <p className="text-sm text-muted-foreground mt-1">Balance</p>
                <p className="text-xs text-muted-foreground">Всего на счету</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-yellow-500">$10</p>
                <p className="text-sm text-muted-foreground mt-1">Frozen</p>
                <p className="text-xs text-muted-foreground">Заморожено под заказы</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-500">$40</p>
                <p className="text-sm text-muted-foreground mt-1">Available</p>
                <p className="text-xs text-muted-foreground">Можно тратить</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Frozen — не списание. Деньги просто заблокированы пока заказ в работе. Выполнен —
              списаны. Провален — возвращены.
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Order statuses */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Статусы заказов</h2>
          <p className="text-muted-foreground mt-1">Что происходит на каждом этапе</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Статус</TableHead>
                  <TableHead>Что значит</TableHead>
                  <TableHead className="hidden sm:table-cell">Деньги</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Badge variant="outline">PENDING</Badge>
                  </TableCell>
                  <TableCell>Заказ создан, ждёт отправки</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    Заморожены
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Badge variant="secondary">PROCESSING</Badge>
                  </TableCell>
                  <TableCell>Выполняется</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    Заморожены
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Badge variant="default">COMPLETED</Badge>
                  </TableCell>
                  <TableCell>Готово</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    Списаны
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Badge variant="secondary">PARTIAL</Badge>
                  </TableCell>
                  <TableCell>Частично выполнен</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    Частично списаны
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Badge variant="destructive">FAILED</Badge>
                  </TableCell>
                  <TableCell>Не удалось</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    Возвращены
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Badge variant="destructive">CANCELLED</Badge>
                  </TableCell>
                  <TableCell>Отменён</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    Возвращены
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* For developers */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Для разработчиков</h2>
          <p className="text-muted-foreground mt-1">API-ключи и вебхуки для автоматизации</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FeatureCard
            icon={Key}
            title="API-ключи"
            description="Управляй заказами из своего кода. Формат: yb_..., три тарифа rate-limit: 100, 500, 2000 запросов в минуту."
          />
          <FeatureCard
            icon={Webhook}
            title="Вебхуки"
            description="Получай POST-уведомления на свой сервер при изменении статуса. HMAC-SHA256 подпись, 3 повтора при сбое."
          />
          <FeatureCard
            icon={Bell}
            title="Email-уведомления"
            description="Автоматические уведомления на почту: заказ создан, выполнен, провален, отменён."
          />
          <FeatureCard
            icon={Clock}
            title="Реальное время"
            description="Статус заказа обновляется каждые 30 секунд. Отслеживай прогресс на странице заказа."
          />
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold">Пример использования API</h3>
            <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
              {`// Авторизация
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
}`}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Security */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Безопасность</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Пароли зашифрованы</p>
              <p className="text-sm text-muted-foreground">
                bcrypt хеширование, пароль никогда не хранится в открытом виде
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">API-ключи захешированы</p>
              <p className="text-sm text-muted-foreground">
                SHA256 — даже при утечке базы ключ не восстановить
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Вебхуки подписаны</p>
              <p className="text-sm text-muted-foreground">
                HMAC-SHA256 — всегда проверяй подпись на своей стороне
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Полный аудит</p>
              <p className="text-sm text-muted-foreground">
                Каждая транзакция записана с балансом до и после
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 text-center space-y-4">
          <h2 className="text-2xl font-bold">Готов начать?</h2>
          <p className="text-muted-foreground">Пополни баланс и создай первый заказ прямо сейчас</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/billing/deposit">
              <Button size="lg">
                <Wallet className="h-4 w-4 mr-2" />
                Пополнить баланс
              </Button>
            </Link>
            <Link href="/catalog">
              <Button variant="outline" size="lg">
                Открыть каталог
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="h-8" />
    </div>
  );
}
