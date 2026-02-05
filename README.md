# youboost SMM Marketplace Platform

🚀 Автоматизированный SMM-маркетплейс для YouTube и других платформ.

[![GitHub](https://img.shields.io/badge/GitHub-psyclr%2Fyouboost-blue)](https://github.com/psyclr/youboost)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)](package.json)

> **Статус**: 🏗️ В разработке (Phase 0 завершена, Phase 1 в процессе)

## Структура проекта

```
/services          # Микросервисы
  /auth-service    # Аутентификация и авторизация
  /billing-service # Управление балансом и транзакциями
  /order-service   # Создание и управление заказами
  /provider-adapter # Интеграция с провайдерами
  /notification-service # Email и webhook уведомления

/shared            # Общий код
  /types           # TypeScript типы
  /utils           # Утилиты
  /constants       # Константы

/tests             # Тесты
  /unit            # Юнит-тесты
  /integration     # Интеграционные тесты
  /e2e             # End-to-end тесты

/docs              # Документация
  /api             # API документация
  /architecture    # Архитектурная документация
  /development     # Гайды для разработчиков
  /deployment      # Инструкции по деплою

/scripts           # Утилитные скрипты
/config            # Конфигурации
```

## Начало работы

### Установка зависимостей

```bash
npm install
```

### Разработка

```bash
npm run test       # Запуск тестов
npm run lint       # Линтинг кода
npm run typecheck  # Проверка типов
npm run build      # Сборка проекта
npm run validate   # Полная валидация (lint + typecheck + test)
```

## Стандарты

- **TypeScript**: Максимальная строгость (strict mode)
- **Тесты**: Минимум 80% coverage
- **Commits**: Conventional Commits формат
- **Code Quality**: ESLint + Prettier + Husky hooks

## Документация

### Архитектура и план

- [План архитектуры](<./План%20архитектуры%20платформы%20youboost%20для%20SMM-маркетплейса%20(1).pdf>)
- [Исследование рынка](<./Глубокое%20исследование%20рынка%20SMM-панелей%20(фокус%20на%20YouTube).pdf>)

### API документация

- [OpenAPI Specification](./docs/api/openapi.yaml) - Основная спецификация API
- [Auth Service API](./docs/api/auth-service.yaml) - Аутентификация
- [Orders Service API](./docs/api/orders-service.yaml) - Управление заказами
- [Billing Service API](./docs/api/billing-service.yaml) - Биллинг и транзакции

### Микросервисы

- [Auth Service](./services/auth-service/README.md) - Документация сервиса аутентификации
- [Billing Service](./services/billing-service/README.md) - Документация биллинг-сервиса
- [Order Service](./services/order-service/README.md) - Документация сервиса заказов
- [Provider Adapter](./services/provider-adapter/README.md) - Документация адаптера провайдеров
- [Notification Service](./services/notification-service/README.md) - Документация сервиса уведомлений

### Разработка

- [Claude Code Context](./.claude.md) - Контекст проекта для Claude
- [MCP Integrations Setup](./MCP_SETUP.md) - 🔌 Настройка MCP интеграций (GitHub, Linear, Context7)
- [Claude Code Hooks](./.claude/hooks/README.md) - Автоматизация через hooks

## 🔌 MCP Интеграции

Проект использует MCP (Model Context Protocol) для автоматизации:

- ✅ **GitHub** (psyclr/youboost) - Автоматические issues, PR reviews
- ✅ **Linear** (Team: SMM) - Автоматическое управление задачами
- ✅ **Context7** - Документация библиотек

Все интеграции полностью настроены и активны. **Подробнее**: [MCP_SETUP.md](./MCP_SETUP.md)

## 🤝 Contributing

1. Клонируйте репозиторий
2. Создайте feature branch (`git checkout -b feat/amazing-feature`)
3. Commit изменения (`git commit -m 'feat: add amazing feature'`)
4. Push в branch (`git push origin feat/amazing-feature`)
5. Откройте Pull Request

Все commits должны следовать [Conventional Commits](https://www.conventionalcommits.org/) формату.

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Links

- **GitHub**: [psyclr/youboost](https://github.com/psyclr/youboost)
- **Issues**: [Report a bug](https://github.com/psyclr/youboost/issues/new)
