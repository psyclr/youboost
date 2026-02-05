# Инструкции для разработки youboost

## Архитектурные принципы

1. **Микросервисная архитектура** - каждый сервис независим и имеет свою зону ответственности
2. **API-first подход** - все взаимодействие через API
3. **Безопасность на всех уровнях** - валидация, аутентификация, шифрование
4. **Масштабируемость с первого дня** - горизонтальное масштабирование, stateless сервисы

## Стандарты кода

- **TypeScript строгий режим**: Все опции strict включены, no-any, no-implicit-any
- **Функциональное программирование**: Предпочитать pure functions, избегать side effects
- **Immutability by default**: Использовать const, readonly, Object.freeze где возможно
- **Явное лучше неявного**: Явная типизация, явные error handling

## Структура проекта

### /services - Микросервисы

Каждый микросервис содержит:

- `src/` - исходный код
- `tests/` - тесты сервиса
- `README.md` - документация сервиса
- `package.json` - зависимости (если нужны специфичные)

### /shared - Общие модули

- `/types` - TypeScript типы и интерфейсы
- `/utils` - Вспомогательные функции
- `/constants` - Константы проекта

### /tests - Тесты

- `/unit` - Юнит-тесты
- `/integration` - Интеграционные тесты
- `/e2e` - End-to-end тесты

### /docs - Документация

- `/api` - API документация (OpenAPI/Swagger)
- `/architecture` - Архитектурные решения
- `/development` - Гайды для разработчиков
- `/deployment` - Инструкции по деплою

## Git workflow

### Branches

- `main` - Production-ready код
- `feat/feature-name` - Новые фичи
- `fix/bug-name` - Исправления багов
- `refactor/description` - Рефакторинг

### Conventional Commits

Формат: `type(scope): message`

**Типы:**

- `feat` - Новая функциональность
- `fix` - Исправление бага
- `docs` - Изменения в документации
- `style` - Форматирование
- `refactor` - Рефакторинг кода
- `test` - Добавление тестов
- `chore` - Изменения в инструментах

**Примеры:**

```
feat(auth): add JWT authentication
fix(billing): resolve payment processing bug
docs(readme): update installation instructions
```

### Pull Requests

- Обязательный code review
- Все CI/CD проверки должны пройти
- Coverage >= 80%
- Обновление документации при необходимости

## Тестирование

### Обязательные требования

- **Unit tests**: 90% coverage
- **Integration tests**: 70% coverage
- **E2E tests**: Критические пути
- **Security tests**: Все уязвимости OWASP Top 10

### TDD подход

1. Написать failing test
2. Написать минимальный код для прохождения теста
3. Рефакторинг
4. Повторить

## Документация

### Обязательное обновление .claude.md при:

1. Добавлении нового микросервиса
2. Изменении архитектуры
3. Обнаружении критического бага
4. Добавлении новых API endpoints
5. Изменении зависимостей
6. Выполнении крупной задачи

### API документация

- OpenAPI/Swagger для всех endpoints
- Примеры запросов и ответов
- Описание error codes
- Rate limiting информация

## Безопасность

### Обязательные меры

- Input validation на всех endpoints
- SQL injection защита (параметризованные запросы)
- XSS защита (escape outputs)
- CSRF tokens
- Rate limiting
- Secrets в environment variables, не в коде
- API keys зашифрованы at rest

### Запрещено

- Хардкодить секреты в коде
- Использовать eval() или аналоги
- Игнорировать security warnings
- Коммитить .env файлы

## Performance

### Требования

- API response time < 100ms (p95)
- Database queries оптимизированы (используем индексы)
- Redis для кэширования часто запрашиваемых данных
- Pagination для больших списков
- Избегать N+1 queries

## Code Review Checklist

Перед созданием PR проверь:

- [ ] Все тесты проходят
- [ ] Coverage >= 80%
- [ ] ESLint без ошибок
- [ ] TypeScript без ошибок
- [ ] Код отформатирован (Prettier)
- [ ] Нет console.log или debugger
- [ ] Нет дублирования кода
- [ ] API документация обновлена
- [ ] .claude.md обновлен (если нужно)
- [ ] Нет security vulnerabilities
