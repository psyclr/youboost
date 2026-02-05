# Database Schema - youboost

## Overview

PostgreSQL база данных для youboost SMM marketplace.

## Tables

### users

Пользователи системы (buyers, resellers, admins).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user', -- user, reseller, admin
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, suspended, banned
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
```

### wallets

Балансы пользователей.

```sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  hold_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00, -- Замороженные средства
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, currency)
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
```

### ledger

История всех транзакций (immutable log).

```sql
CREATE TABLE ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  type VARCHAR(50) NOT NULL, -- deposit, withdraw, hold, release, refund, fee
  amount DECIMAL(15, 2) NOT NULL,
  balance_before DECIMAL(15, 2) NOT NULL,
  balance_after DECIMAL(15, 2) NOT NULL,
  reference_type VARCHAR(50), -- order, payment, etc
  reference_id UUID,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ledger_user_id ON ledger(user_id);
CREATE INDEX idx_ledger_wallet_id ON ledger(wallet_id);
CREATE INDEX idx_ledger_created_at ON ledger(created_at DESC);
CREATE INDEX idx_ledger_reference ON ledger(reference_type, reference_id);
```

### services

Каталог услуг (просмотры, подписчики, лайки и т.д.).

```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  platform VARCHAR(50) NOT NULL, -- youtube, instagram, tiktok, etc
  type VARCHAR(50) NOT NULL, -- views, subscribers, likes, comments, etc
  price_per_1000 DECIMAL(10, 2) NOT NULL,
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_services_platform ON services(platform);
CREATE INDEX idx_services_type ON services(type);
CREATE INDEX idx_services_is_active ON services(is_active);
```

### orders

Заказы пользователей.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  service_id UUID NOT NULL REFERENCES services(id),
  provider_id UUID REFERENCES providers(id),
  external_order_id VARCHAR(255), -- ID заказа у провайдера

  -- Детали заказа
  link TEXT NOT NULL, -- URL видео/профиля
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,

  -- Статусы
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, partial, cancelled, failed, refunded
  start_count INTEGER, -- Начальное количество (views/subscribers)
  remains INTEGER, -- Осталось выполнить

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_service_id ON orders(service_id);
CREATE INDEX idx_orders_provider_id ON orders(provider_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

### providers

Внешние провайдеры услуг (Tier 1).

```sql
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  api_endpoint TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0, -- Приоритет при выборе провайдера
  balance DECIMAL(15, 2), -- Баланс у провайдера (если применимо)
  metadata JSONB, -- Дополнительные настройки
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_providers_is_active ON providers(is_active);
CREATE INDEX idx_providers_priority ON providers(priority DESC);
```

### api_keys

API ключи для реселлеров.

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL, -- Имя ключа для идентификации
  permissions JSONB, -- Разрешения
  rate_limit_tier VARCHAR(50) NOT NULL DEFAULT 'basic', -- basic, pro, enterprise
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
```

### webhooks

Webhook subscriptions для уведомлений.

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- ['order.completed', 'order.failed', etc]
  secret VARCHAR(255) NOT NULL, -- Для подписи webhook payload
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);
```

## Indexes Strategy

### Performance Indexes

- Все foreign keys имеют индексы
- Timestamp поля (created_at) для сортировки
- Status поля для фильтрации
- Email и api_key для быстрого поиска

### Future Indexes (добавить при росте данных)

- Partitioning для `ledger` и `orders` по датам
- Composite indexes для частых запросов
- Full-text search indexes для поиска

## Data Integrity

### Constraints

- Foreign keys с ON DELETE CASCADE/RESTRICT
- NOT NULL для критических полей
- UNIQUE для уникальных полей (email, api_key)
- CHECK constraints для валидации (balance >= 0, quantity > 0)

### Triggers (потенциально)

- Автоматическое обновление `updated_at`
- Валидация изменений баланса
- Audit log для критических операций

## Estimated Size (через год)

- **users**: ~10,000 rows (~2MB)
- **wallets**: ~20,000 rows (~3MB)
- **ledger**: ~10,000,000 rows (~2GB) - партиционировать!
- **orders**: ~5,000,000 rows (~1GB) - партиционировать!
- **services**: ~500 rows (~100KB)
- **providers**: ~50 rows (~50KB)
- **api_keys**: ~500 rows (~100KB)
- **webhooks**: ~1,000 rows (~200KB)

**Total**: ~3GB (без учета indexes)
