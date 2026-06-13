import type { Metadata } from 'next';
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
  Eye,
  ThumbsUp,
  UserPlus,
  MessageCircle,
  Share2,
  ArrowRight,
  CheckCircle,
  ChevronRight,
  Wallet,
} from 'lucide-react';
import {
  GUIDE_HERO_ICON,
  GUIDE_STEPS,
  GUIDE_PLATFORMS,
  GUIDE_PRICING_FEATURES,
  GUIDE_DEVELOPER_FEATURES,
  GUIDE_WALLET_STATS,
  GUIDE_ORDER_STATUSES,
  GUIDE_SECURITY_POINTS,
  GUIDE_API_EXAMPLE,
  type FeatureItem,
  type GuideStep,
} from '@/content/guide';

export const metadata: Metadata = {
  title: 'Руководство — youboost',
  description: 'Как продвигать контент через youboost: каталог, заказы, кошелёк, API и безопасность.',
};

function FeatureCard({
  icon: Icon,
  title,
  description,
}: Readonly<FeatureItem>): React.ReactElement {
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

function StepCard({ step, title, description, action }: Readonly<GuideStep>): React.ReactElement {
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
  const HeroIcon = GUIDE_HERO_ICON;
  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center space-y-4 pt-4">
        <div className="flex items-center justify-center gap-2 mb-6">
          <HeroIcon className="h-8 w-8 text-primary" />
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
          {GUIDE_STEPS.map((s) => (
            <StepCard key={s.step} {...s} />
          ))}
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
          {GUIDE_PLATFORMS.map((platform) => {
            const PlatformIcon = platform.icon;
            return (
              <Card key={platform.name}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={platform.iconWrapClassName}>
                      <PlatformIcon className={platform.iconClassName} />
                    </div>
                    <span className="font-semibold">{platform.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {platform.badges.map((badge) => (
                      <Badge key={badge.label} variant="outline">
                        <ServiceTypeIcon type={badge.type} />
                        <span className="ml-1">{badge.label}</span>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
          {GUIDE_PRICING_FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
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
              {GUIDE_WALLET_STATS.map((stat) => (
                <div key={stat.label}>
                  <p className={`text-3xl font-bold${stat.valueClassName ? ` ${stat.valueClassName}` : ''}`}>
                    {stat.value}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                  <p className="text-xs text-muted-foreground">{stat.hint}</p>
                </div>
              ))}
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
                {GUIDE_ORDER_STATUSES.map((row) => (
                  <TableRow key={row.status}>
                    <TableCell>
                      <Badge variant={row.variant}>{row.status}</Badge>
                    </TableCell>
                    <TableCell>{row.meaning}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {row.money}
                    </TableCell>
                  </TableRow>
                ))}
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
          {GUIDE_DEVELOPER_FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold">Пример использования API</h3>
            <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
              {GUIDE_API_EXAMPLE}
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
          {GUIDE_SECURITY_POINTS.map((point) => (
            <div key={point.title} className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">{point.title}</p>
                <p className="text-sm text-muted-foreground">{point.description}</p>
              </div>
            </div>
          ))}
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
