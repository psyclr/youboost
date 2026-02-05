# Notification Service

Сервис отправки уведомлений пользователям.

## 📋 Описание

Notification Service отвечает за:

- Email уведомления
- Webhook уведомления (для API клиентов)
- Push уведомления (будущее)
- SMS уведомления (опционально)
- Управление templates
- Отслеживание доставки

## 🏗️ Архитектура

### Зависимости

- **PostgreSQL** - хранение истории уведомлений
- **Redis** - очередь уведомлений и rate limiting
- **Email Provider** (SendGrid/AWS SES)

### Event-Driven

Notification Service слушает события от других сервисов:

- Order Service: изменение статуса заказа
- Billing Service: пополнение баланса, транзакции
- Auth Service: верификация email, сброс пароля

## 📬 Notification Types

### Email Notifications

- **Welcome Email**: При регистрации
- **Email Verification**: Подтверждение email
- **Password Reset**: Восстановление пароля
- **Order Status**: Изменение статуса заказа
- **Balance Update**: Пополнение/списание
- **Low Balance Warning**: Баланс < $10

### Webhook Notifications

Для API клиентов:

- Order status changes
- Balance updates
- Custom events

### Push Notifications (Future)

- Browser push
- Mobile push (iOS/Android)

## 🚀 Internal API

### POST /notifications/send

Отправить уведомление.

**Request:**

```json
{
  "userId": "uuid",
  "type": "email",
  "template": "order_completed",
  "data": {
    "orderId": "uuid",
    "serviceId": "youtube_views",
    "quantity": 1000
  },
  "priority": "normal"
}
```

**Response:**

```json
{
  "notificationId": "uuid",
  "status": "queued",
  "estimatedDelivery": "2024-01-01T10:00:05Z"
}
```

### POST /notifications/webhook/register

Регистрация webhook endpoint пользователя.

**Request:**

```json
{
  "url": "https://user-api.com/webhook",
  "events": ["order.completed", "order.cancelled", "balance.updated"],
  "secret": "webhook_secret"
}
```

**Response:**

```json
{
  "webhookId": "uuid",
  "status": "active"
}
```

### GET /notifications/history

История уведомлений пользователя.

**Response:**

```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "email",
      "template": "order_completed",
      "status": "delivered",
      "sentAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

## 📝 Email Templates

### Template Structure

```typescript
interface EmailTemplate {
  id: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
}
```

### Available Templates

- `welcome` - Приветственное письмо
- `verify_email` - Верификация email
- `password_reset` - Сброс пароля
- `order_pending` - Заказ создан
- `order_processing` - Заказ в обработке
- `order_completed` - Заказ выполнен
- `order_cancelled` - Заказ отменен
- `balance_low` - Низкий баланс
- `balance_credited` - Пополнение баланса

### Template Variables

```handlebars
{{username}}
{{orderId}}
{{serviceId}}
{{quantity}}
{{price}}
{{balance}}
{{verificationLink}}
{{resetPasswordLink}}
```

## 🔔 Webhook Delivery

### Delivery Guarantees

- **At-least-once delivery**: Гарантия доставки
- **Retry strategy**: 3 попытки с exponential backoff
- **Timeout**: 30 секунд на ответ
- **Signature**: HMAC-SHA256 подпись

### Webhook Payload

```json
{
  "event": "order.completed",
  "timestamp": "2024-01-01T10:00:00Z",
  "data": {
    "orderId": "uuid",
    "status": "completed",
    "quantity": 1000
  }
}
```

### Webhook Headers

```
X-Webhook-Signature: sha256=...
X-Webhook-Event: order.completed
X-Webhook-Timestamp: 1704103200
X-Webhook-Id: uuid
```

## 🔄 Delivery Flow

### Email Flow

1. Событие от другого сервиса
2. Добавление в Redis queue
3. Worker обрабатывает очередь
4. Рендеринг template с данными
5. Отправка через email provider
6. Обработка delivery status
7. Retry при ошибках

### Webhook Flow

1. Событие от другого сервиса
2. Поиск активных webhooks пользователя
3. Генерация signature
4. Отправка POST запроса
5. Retry при ошибках/timeout
6. Логирование результата

## 🛡️ Rate Limiting

### Email Rate Limits

- 10 emails per minute per user
- 100 emails per hour per user
- Anti-spam protection

### Webhook Rate Limits

- 100 webhooks per minute per endpoint
- Circuit breaker при множественных ошибках

## 🧪 Тестирование

### Unit Tests

```bash
npm test -- services/notification-service
```

### Integration Tests

Тестирование с mock email/webhook providers:

```bash
npm run test:integration -- notification-service
```

### Template Testing

Проверка корректности всех email templates:

```bash
npm run test:templates
```

### Test Coverage Target

- **Минимум**: 75%
- **Цель**: 85%

## 📊 Мониторинг

### Метрики

- Email delivery rate
- Webhook delivery rate
- Average delivery time
- Failed delivery count
- Queue depth

### Alerts

- Email delivery rate < 95%
- Webhook delivery rate < 90%
- Queue depth > 1000
- Email provider API down

## 🚧 Статус

**Версия**: 0.0.0 (не реализован)
**Приоритет**: 🟡 Высокий (может разрабатываться параллельно с core сервисами)

## 🔗 Связанные документы

- [Email Templates](../../docs/templates/)
- [Webhook API](../../docs/api/webhooks.md)
- [Event Schema](../../docs/architecture/events.md)
