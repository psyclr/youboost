# Auth Service

Сервис аутентификации и авторизации пользователей youboost.

## 📋 Описание

Auth Service отвечает за:

- Регистрацию новых пользователей
- Аутентификацию (JWT tokens)
- Управление сессиями
- Верификацию email
- Восстановление пароля
- Управление ролями и правами доступа

## 🏗️ Архитектура

### Зависимости

- **PostgreSQL** - хранение пользователей и сессий
- **Redis** - кэширование токенов и rate limiting
- **JWT** - генерация и валидация токенов

### Внешние API

- Email Service (для верификации)
- Audit Log Service (для логирования)

## 🚀 API Endpoints

### POST /auth/register

Регистрация нового пользователя.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "username": "username"
}
```

**Response:**

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "verificationRequired": true
}
```

### POST /auth/login

Вход в систему.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**

```json
{
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "expiresIn": 3600
}
```

### GET /auth/me

Получение информации о текущем пользователе.

**Headers:**

```
Authorization: Bearer {accessToken}
```

**Response:**

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "username": "username",
  "roles": ["user"],
  "verified": true
}
```

### POST /auth/refresh

Обновление access token.

**Request:**

```json
{
  "refreshToken": "refresh_token"
}
```

**Response:**

```json
{
  "accessToken": "new_jwt_token",
  "expiresIn": 3600
}
```

### POST /auth/logout

Выход из системы.

**Headers:**

```
Authorization: Bearer {accessToken}
```

**Response:**

```json
{
  "success": true
}
```

## 🔒 Безопасность

- **Password hashing**: bcrypt с salt rounds = 12
- **JWT secret**: 256-bit ключ из environment
- **Rate limiting**: 5 попыток входа за 15 минут
- **Token rotation**: Refresh tokens обновляются при каждом использовании
- **HTTPS only**: Все токены передаются только по HTTPS

## 🧪 Тестирование

### Unit Tests

```bash
npm test -- services/auth-service
```

### Integration Tests

```bash
npm run test:integration -- auth-service
```

### Test Coverage Target

- **Минимум**: 80%
- **Цель**: 90%

## 📊 Мониторинг

### Метрики

- Количество успешных/неуспешных логинов
- Время ответа API
- Количество активных сессий
- Rate limit violations

### Логирование

Все операции логируются с уровнями:

- `info`: Успешные операции
- `warn`: Неуспешные попытки входа
- `error`: Системные ошибки

## 🚧 Статус

**Версия**: 0.0.0 (не реализован)
**Приоритет**: 🔴 Критический (блокирует все остальные сервисы)

## 🔗 Связанные документы

- [API Specification](../../docs/api/auth-service.yaml)
- [Database Schema](../../docs/architecture/database-schema.md)
- [Security Guidelines](../../docs/security/guidelines.md)
