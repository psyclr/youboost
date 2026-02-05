# Provider Adapter

Адаптер для интеграции с внешними провайдерами SMM-услуг.

## 📋 Описание

Provider Adapter отвечает за:

- Унифицированный интерфейс работы с разными провайдерами
- Отправку заказов провайдерам
- Получение статусов выполнения
- Обработку webhooks от провайдеров
- Retry logic при сбоях
- Circuit breaker для неработающих провайдеров

## 🏗️ Архитектура

### Зависимости

- **Redis** - кэш статусов и rate limiting
- Нет прямых зависимостей на другие сервисы (stateless)

### Интеграция

Внутренний сервис, используется только Order Service.

## 🔌 Supported Providers

### Provider API Types

1. **REST API** - HTTP запросы к API провайдера
2. **SOAP API** - Legacy SOAP интеграция
3. **Webhook based** - Провайдер сам пушит статусы

### Provider Configuration

```typescript
interface ProviderConfig {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  type: 'rest' | 'soap' | 'webhook';
  services: ServiceMapping[];
  rateLimit: number;
  timeout: number;
  retries: number;
}
```

## 🚀 Internal API

### POST /adapter/order

Отправить заказ провайдеру.

**Request:**

```json
{
  "providerId": "provider_xyz",
  "serviceId": "youtube_views",
  "link": "https://youtube.com/watch?v=xxx",
  "quantity": 1000
}
```

**Response:**

```json
{
  "providerOrderId": "external_order_id",
  "status": "pending",
  "estimatedTime": 86400
}
```

### GET /adapter/order/:providerOrderId

Получить статус заказа от провайдера.

**Response:**

```json
{
  "providerOrderId": "external_order_id",
  "status": "in_progress",
  "completed": 450,
  "remains": 550,
  "startCount": 5432
}
```

### DELETE /adapter/order/:providerOrderId

Отменить заказ у провайдера (если поддерживается).

**Response:**

```json
{
  "providerOrderId": "external_order_id",
  "status": "cancelled",
  "refundable": true
}
```

### GET /adapter/services

Получить список доступных услуг от всех провайдеров.

**Response:**

```json
{
  "services": [
    {
      "serviceId": "youtube_views",
      "providers": [
        {
          "providerId": "provider_xyz",
          "price": 0.005,
          "min": 100,
          "max": 100000,
          "reliability": 0.98
        }
      ]
    }
  ]
}
```

### POST /adapter/webhook/:providerId

Webhook endpoint для получения обновлений от провайдеров.

## 🔄 Provider Integration Flow

### Order Creation

1. Валидация параметров заказа
2. Маппинг внутреннего serviceId на ID провайдера
3. Отправка запроса к API провайдера
4. Retry при ошибках (exponential backoff)
5. Возврат providerOrderId

### Status Sync

Два метода:

1. **Polling**: Периодический опрос статуса (для REST API)
2. **Webhook**: Провайдер сам отправляет обновления

### Error Handling

- **Provider down**: Circuit breaker после N failed requests
- **Timeout**: Retry с exponential backoff
- **Invalid response**: Логирование и fallback на polling

## 🛡️ Reliability

### Circuit Breaker

```typescript
interface CircuitBreakerConfig {
  failureThreshold: 5; // Failed requests before open
  successThreshold: 2; // Success requests to close
  timeout: 60000; // Time before retry (ms)
}
```

**States:**

- **CLOSED**: Normal operation
- **OPEN**: Provider unavailable (skip requests)
- **HALF_OPEN**: Testing provider recovery

### Retry Strategy

```typescript
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // Initial delay 1s
  maxDelay: 10000, // Max delay 10s
  factor: 2, // Exponential factor
};
```

### Rate Limiting

- Per provider rate limits
- Global rate limit для защиты от DDoS

## 🔒 Безопасность

- **API Key encryption**: Ключи провайдеров зашифрованы at rest
- **Webhook signature**: Валидация подписи webhooks
- **IP whitelist**: Только известные IP провайдеров
- **Request validation**: Валидация всех входящих данных

## 🧪 Тестирование

### Unit Tests

```bash
npm test -- services/provider-adapter
```

### Integration Tests

Тестирование с mock провайдерами:

```bash
npm run test:integration -- provider-adapter
```

### Provider Simulation

Mock server для эмуляции различных провайдеров:

- Success flow
- Timeout scenarios
- Rate limiting
- Webhook delivery

### Test Coverage Target

- **Минимум**: 85%
- **Цель**: 90%

## 📊 Мониторинг

### Метрики

- Success/Failure rate по провайдерам
- Среднее время ответа API
- Circuit breaker state changes
- Webhook delivery rate
- Retry attempts

### Alerts

- Provider circuit breaker opened
- High retry rate (> 10%)
- Webhook signature validation failed
- Provider API response time > 5s

## 🚧 Статус

**Версия**: 0.0.0 (не реализован)
**Приоритет**: 🔴 Критический (требуется для Order Service)

## 🔗 Связанные документы

- [Provider Integration Guide](../../docs/architecture/provider-integration.md)
- [Provider API Specs](../../docs/providers/)
- [Circuit Breaker Pattern](../../docs/architecture/circuit-breaker.md)
