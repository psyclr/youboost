# youboost SMM Marketplace Platform

Автоматизированный SMM-маркетплейс для YouTube и других платформ.

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

- [План архитектуры](<./План%20архитектуры%20платформы%20youboost%20для%20SMM-маркетплейса%20(1).pdf>)
- [Исследование рынка](<./Глубокое%20исследование%20рынка%20SMM-панелей%20(фокус%20на%20YouTube).pdf>)
- [Claude контекст](./.claude.md) (будет создан)
