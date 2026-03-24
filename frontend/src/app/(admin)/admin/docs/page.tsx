'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ShoppingCart,
  Globe,
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Ban,
  TrendingUp,
  Users,
  Package,
  Settings,
} from 'lucide-react';

function CodeBlock({ children }: Readonly<{ children: string }>): React.ReactElement {
  return (
    <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: Readonly<{
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-primary" />}
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="space-y-4 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function SubSection({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function Callout({
  type = 'info',
  children,
}: Readonly<{
  type?: 'info' | 'warning' | 'success';
  children: React.ReactNode;
}>): React.ReactElement {
  const styles = {
    info: 'border-primary/30 bg-primary/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    success: 'border-green-500/30 bg-green-500/5',
  };
  return <div className={`border rounded-lg p-4 text-sm ${styles[type]}`}>{children}</div>;
}

function StatusBadge({ status }: Readonly<{ status: string }>): React.ReactElement {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    COMPLETED: 'default',
    PROCESSING: 'secondary',
    PENDING: 'outline',
    FAILED: 'destructive',
    PARTIAL: 'secondary',
    CANCELLED: 'destructive',
    REFUNDED: 'outline',
    ACTIVE: 'default',
    SUSPENDED: 'secondary',
    BANNED: 'destructive',
  };
  return <Badge variant={variants[status] ?? 'outline'}>{status}</Badge>;
}

function FlowStep({
  step,
  title,
  description,
}: Readonly<{
  step: number;
  title: string;
  description: string;
}>): React.ReactElement {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
        {step}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN GUIDE TAB
// ---------------------------------------------------------------------------

function AdminGuide(): React.ReactElement {
  return (
    <div className="space-y-8">
      {/* Intro */}
      <Card>
        <CardHeader>
          <CardTitle>Общая картина</CardTitle>
          <CardDescription>Что делает админ в YouBoost</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Ты — оператор маркетплейса. Твои задачи:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <Server className="h-4 w-4 mt-0.5 text-primary" />
              <span>
                <strong>Подключить поставщиков</strong> — внешние SMM-панели с API
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 mt-0.5 text-primary" />
              <span>
                <strong>Настроить каталог</strong> — услуги и цены (твоя маржа)
              </span>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 mt-0.5 text-primary" />
              <span>
                <strong>Следить за системой</strong> — заказы, пользователи, баланс
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Settings className="h-4 w-4 mt-0.5 text-primary" />
              <span>
                <strong>Решать проблемы</strong> — рефанды, блокировки, статусы
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Providers */}
      <Section title="Поставщики" icon={Server}>
        <SubSection title="Что такое поставщик?">
          <p>
            Поставщик — это внешний SMM-сервис с API. У него есть ресурсы для накрутки просмотров,
            лайков, подписчиков. YouBoost отправляет ему заказы и опрашивает статус.
          </p>
          <p>
            Почти все панели используют <strong>одинаковый формат API</strong> (индустриальный
            стандарт), поэтому подключение любого поставщика выглядит одинаково.
          </p>
        </SubSection>

        <SubSection title="Как подключить">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Поле</TableHead>
                <TableHead>Что это</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-xs">name</TableCell>
                <TableCell>Название для себя (видно только в админке)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">apiEndpoint</TableCell>
                <TableCell>URL API поставщика (даёт при регистрации)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">apiKey</TableCell>
                <TableCell>Ключ API (поставщик выдаёт в ЛК). Шифруется AES-256</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">priority</TableCell>
                <TableCell>Приоритет: чем выше число, тем первее используется</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <CodeBlock>{`POST /providers
{
  "name": "SMM Panel Alpha",
  "apiEndpoint": "https://smmpanel.example.com/api/v2",
  "apiKey": "abc123secretkey",
  "priority": 10
}`}</CodeBlock>
        </SubSection>

        <SubSection title="Несколько поставщиков">
          <p>
            Система выбирает <strong>самого приоритетного активного</strong>:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge>priority: 10</Badge>
              <span>Provider A</span>
              <Badge variant="default">active</Badge>
              <span className="text-muted-foreground">← выбирается первым</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">priority: 5</Badge>
              <span>Provider B</span>
              <Badge variant="default">active</Badge>
              <span className="text-muted-foreground">← запасной</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">priority: 3</Badge>
              <span>Provider C</span>
              <Badge variant="destructive">inactive</Badge>
              <span className="text-muted-foreground">← не используется</span>
            </div>
          </div>
        </SubSection>

        <SubSection title="Circuit Breaker (автозащита)">
          <Callout type="warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Если поставщик <strong>5 раз подряд</strong> не ответил — система перестаёт его
                дёргать <strong>на 60 секунд</strong>. Потом пробует снова. Один успешный запрос
                сбрасывает счётчик.
              </p>
            </div>
          </Callout>
        </SubSection>

        <SubSection title="Как поставщик выполняет заказ">
          <div className="space-y-3">
            <FlowStep
              step={1}
              title="Пользователь нажал 'Заказать'"
              description="5000 просмотров на YouTube"
            />
            <FlowStep
              step={2}
              title="YouBoost выбирает поставщика"
              description="Самый приоритетный из активных"
            />
            <FlowStep
              step={3}
              title="HTTP-запрос на API поставщика"
              description="action=add, service, link, quantity"
            />
            <FlowStep
              step={4}
              title="Поставщик возвращает ID заказа"
              description='{ "order": 78901 }'
            />
            <FlowStep
              step={5}
              title="Каждые 30 сек проверяем статус"
              description="action=status, order=78901"
            />
            <FlowStep
              step={6}
              title="Статус обновляется"
              description="completed → списание денег → уведомление"
            />
          </div>
        </SubSection>

        <SubSection title="Stub-режим (для разработки)">
          <Callout type="info">
            <p>
              Если <code className="bg-muted px-1 rounded">PROVIDER_MODE=stub</code> — заказы не
              уходят на реальных поставщиков. Используется мок: принимает заказ, но статус навсегда
              остаётся PROCESSING. Для боевой работы:{' '}
              <code className="bg-muted px-1 rounded">PROVIDER_MODE=real</code>.
            </p>
          </Callout>
        </SubSection>
      </Section>

      <Separator />

      {/* Catalog */}
      <Section title="Каталог — настройка услуг" icon={Package}>
        <SubSection title="Создание услуги">
          <p>
            На странице <strong>Services</strong> нажми &quot;Add Service&quot;:
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Поле</TableHead>
                <TableHead>Пример</TableHead>
                <TableHead>Объяснение</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Name</TableCell>
                <TableCell>YouTube Views — Premium</TableCell>
                <TableCell>Что увидит клиент</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Platform</TableCell>
                <TableCell>
                  <Badge variant="outline">YOUTUBE</Badge>
                </TableCell>
                <TableCell>Площадка</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Type</TableCell>
                <TableCell>
                  <Badge variant="outline">VIEWS</Badge>
                </TableCell>
                <TableCell>Тип услуги</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Price per 1000</TableCell>
                <TableCell>$1.50</TableCell>
                <TableCell>Твоя цена (с наценкой!)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Min / Max</TableCell>
                <TableCell>100 / 100000</TableCell>
                <TableCell>Лимиты количества</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </SubSection>

        <SubSection title="Ценообразование (маржа)">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span>Поставщик продаёт тебе:</span>
                  <span className="text-muted-foreground">$0.50 / 1000</span>
                </div>
                <div className="flex justify-between">
                  <span>Ты ставишь в каталог:</span>
                  <span>$1.50 / 1000</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-green-600">
                  <span>Твоя маржа:</span>
                  <span>$1.00 / 1000</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <p className="text-muted-foreground">
            Клиент видит только твою цену. Цена поставщика — твоя себестоимость.
          </p>
        </SubSection>
      </Section>

      <Separator />

      {/* Users */}
      <Section title="Управление пользователями" icon={Users}>
        <SubSection title="Роли">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Роль</TableHead>
                <TableHead>Что даёт</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <StatusBadge status="ACTIVE" />
                </TableCell>
                <TableCell>USER — обычный пользователь, может покупать услуги</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Badge variant="secondary">RESELLER</Badge>
                </TableCell>
                <TableCell>Реселлер — то же что USER (роль на будущее)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Badge>ADMIN</Badge>
                </TableCell>
                <TableCell>Полный доступ к админке</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </SubSection>

        <SubSection title="Статусы">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Статус</TableHead>
                <TableHead>Эффект</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <StatusBadge status="ACTIVE" />
                </TableCell>
                <TableCell>Всё работает нормально</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <StatusBadge status="SUSPENDED" />
                </TableCell>
                <TableCell>Временная блокировка (можно разблокировать)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <StatusBadge status="BANNED" />
                </TableCell>
                <TableCell>Полная блокировка</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </SubSection>

        <SubSection title="Корректировка баланса">
          <p>
            На странице деталей пользователя — два поля: <strong>Сумма</strong> и{' '}
            <strong>Причина</strong>.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default">+50</Badge>
              <span className="text-muted-foreground">
                &quot;Компенсация за сбой при заказе #abc123&quot;
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive">-10</Badge>
              <span className="text-muted-foreground">&quot;Штраф за нарушение правил&quot;</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">+100</Badge>
              <span className="text-muted-foreground">
                &quot;Промо-бонус для нового клиента&quot;
              </span>
            </div>
          </div>
          <p className="text-muted-foreground">
            Причина обязательна — записывается в ledger для аудита. Тип: ADMIN_ADJUSTMENT.
          </p>
        </SubSection>
      </Section>

      <Separator />

      {/* Orders */}
      <Section title="Управление заказами" icon={ShoppingCart}>
        <SubSection title="Принудительная смена статуса">
          <p>Кнопка &quot;Status&quot; на строке заказа. Когда это нужно:</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span>
                Поставщик выполнил, но API не обновил статус → ставишь{' '}
                <StatusBadge status="COMPLETED" />
              </span>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span>
                Поставщик отменил на своей стороне → ставишь <StatusBadge status="FAILED" />
              </span>
            </div>
          </div>
          <Callout type="warning">
            <p>
              <strong>Важно:</strong> принудительная смена статуса НЕ трогает деньги автоматически.
              Для возврата денег используй рефанд отдельно.
            </p>
          </Callout>
        </SubSection>

        <SubSection title="Рефанд">
          <p>Кнопка &quot;Refund&quot; на строке заказа:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Деньги возвращаются на баланс пользователя</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>
                Статус заказа → <StatusBadge status="REFUNDED" />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Запись в ledger типа REFUND</span>
            </div>
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-destructive" />
              <span>Повторный рефанд невозможен (защита от дублей)</span>
            </div>
          </div>
        </SubSection>
      </Section>

      <Separator />

      {/* Monitoring */}
      <Section title="Мониторинг" icon={AlertTriangle}>
        <SubSection title="На что обращать внимание">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <p className="font-medium mb-2">Заказы в PROCESSING слишком долго</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Поставщик лежит (проверь его сайт/API)</li>
                  <li>Circuit breaker сработал (подожди 60 сек)</li>
                  <li>Stub-режим включён (заказы никогда не завершатся)</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="font-medium mb-2">Много FAILED заказов подряд</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>У поставщика нет ресурсов для выполнения</li>
                  <li>API-ключ просрочился или отозван</li>
                  <li>Поставщик заблокировал аккаунт</li>
                  <li>Некорректный service ID</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="font-medium mb-2">Баланс поставщика</p>
                <p className="text-muted-foreground">
                  Поле <code className="bg-muted px-1 rounded">balance</code> в модели Provider не
                  обновляется автоматически. Проверяй баланс на панели поставщика вручную.
                </p>
              </CardContent>
            </Card>
          </div>
        </SubSection>
      </Section>

      <Separator />

      {/* Scenarios */}
      <Section title="Типичные сценарии" icon={RefreshCw}>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Подключение нового поставщика</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <FlowStep
                step={1}
                title="Регистрируешься на SMM-панели"
                description="Получаешь API Key и API URL в личном кабинете"
              />
              <FlowStep
                step={2}
                title="POST /providers"
                description="name, apiEndpoint, apiKey, priority"
              />
              <FlowStep
                step={3}
                title="В .env ставишь PROVIDER_MODE=real"
                description="Переключаешь с тестового режима"
              />
              <FlowStep
                step={4}
                title="Перезапускаешь сервер"
                description="Новые заказы пойдут на этого поставщика"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Клиент жалуется что заказ не выполнен</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <FlowStep step={1} title="Находишь заказ в Orders" description="Смотришь статус" />
              <FlowStep
                step={2}
                title="PROCESSING → проверяешь поставщика"
                description="Или ждёшь, или рефанд"
              />
              <FlowStep
                step={3}
                title="Если нужен возврат → Refund"
                description="Деньги вернутся на баланс клиента"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Дать бонус клиенту</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <FlowStep
                step={1}
                title="Users → находишь пользователя"
                description="Переходишь в детали"
              />
              <FlowStep
                step={2}
                title='Amount: 25, Reason: "Welcome bonus"'
                description="В блоке Wallet"
              />
              <FlowStep
                step={3}
                title="Adjust → на балансе +$25"
                description="Запись в ledger для аудита"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Заблокировать мошенника</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <FlowStep
                step={1}
                title="Users → находишь пользователя"
                description="Меняешь Status → BANNED"
              />
              <FlowStep
                step={2}
                title="Активные заказы продолжат выполняться"
                description="Если нужно остановить — меняй статусы на CANCELLED + рефанд"
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Separator />

      {/* Environment */}
      <Section title="Переменные окружения" icon={Settings}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Переменная</TableHead>
              <TableHead>Что значит</TableHead>
              <TableHead>Пример</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono text-xs">PROVIDER_MODE</TableCell>
              <TableCell>stub (тест) или real (боевой)</TableCell>
              <TableCell>
                <Badge variant="outline">real</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-xs">ORDER_POLL_INTERVAL_MS</TableCell>
              <TableCell>Как часто опрашивать поставщиков</TableCell>
              <TableCell>30000 (30 сек)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-xs">CIRCUIT_BREAKER_THRESHOLD</TableCell>
              <TableCell>Ошибок до блокировки поставщика</TableCell>
              <TableCell>5</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-xs">CIRCUIT_BREAKER_COOLDOWN_MS</TableCell>
              <TableCell>Пауза после блокировки</TableCell>
              <TableCell>60000 (60 сек)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-xs">RATE_LIMIT_MAX</TableCell>
              <TableCell>Глобальный лимит запросов</TableCell>
              <TableCell>100</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Separator />

      {/* API Reference */}
      <Section title="API-эндпоинты админки" icon={Globe}>
        <div className="space-y-4">
          <SubSection title="Дашборд">
            <CodeBlock>{'GET /admin/dashboard/stats'}</CodeBlock>
          </SubSection>
          <SubSection title="Пользователи">
            <CodeBlock>{`GET    /admin/users                        — Список (role, status, page, limit)
GET    /admin/users/:userId                — Детали + кошелёк
PATCH  /admin/users/:userId                — Изменить роль/статус
POST   /admin/users/:userId/balance/adjust — Корректировка баланса`}</CodeBlock>
          </SubSection>
          <SubSection title="Заказы">
            <CodeBlock>{`GET    /admin/orders                   — Список (status, userId, page, limit)
GET    /admin/orders/:orderId          — Детали
PATCH  /admin/orders/:orderId/status   — Принудительная смена статуса
POST   /admin/orders/:orderId/refund   — Рефанд`}</CodeBlock>
          </SubSection>
          <SubSection title="Каталог услуг">
            <CodeBlock>{`GET    /admin/services              — Список всех услуг
POST   /admin/services              — Создать услугу
PATCH  /admin/services/:serviceId   — Обновить услугу
DELETE /admin/services/:serviceId   — Деактивировать`}</CodeBlock>
          </SubSection>
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------------------------

export default function AdminDocsPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-muted-foreground">Руководство по управлению платформой YouBoost</p>
      </div>

      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="pr-4">
          <AdminGuide />
        </div>
      </ScrollArea>
    </div>
  );
}
