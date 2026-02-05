# 🔌 Настройка MCP Интеграций

Все MCP интеграции **АКТИВИРОВАНЫ** и готовы к работе!

## ✅ Что уже настроено

### 1. GitHub Integration ✓

**Репозиторий**: [psyclr/youboost](https://github.com/psyclr/youboost)

- ✅ Автоматическое создание issues при ошибках
- ✅ Issues с резюме завершенных задач
- ✅ Сохранение планов в виде issues
- ✅ PR review comments (опционально)

### 2. Context7 Documentation ✓

- ✅ Автоматически получает документацию для библиотек
- ✅ Работает через MCP без настройки
- ✅ Доступно через Claude Code

### 3. Claude Code Hooks ✓

Все hooks активированы и настроены:

- ✅ `on-task-start` - создание Linear tasks, feature branches
- ✅ `on-task-complete` - validation, GitHub issues
- ✅ `on-error` - автоматические bug reports
- ✅ `on-file-edit` - ESLint, Prettier, type checking
- ✅ `on-plan-create` - сохранение планов
- ✅ `on-review-request` - code review automation

## ⚙️ Что нужно настроить

### Linear Integration (опционально)

Если хотите использовать Linear для управления задачами:

1. **Найдите ваш Linear Team ID:**

   **Способ 1: Через URL**

   ```
   1. Откройте любую issue в Linear
   2. URL будет вида: linear.app/TEAM_NAME/issue/...
   3. TEAM_NAME - это ваш Team ID
   ```

   **Способ 2: Через Linear API** (если доступен MCP)

   ```bash
   # Используйте Claude для получения списка teams
   claude mcp linear list-teams
   ```

2. **Настройте конфигурацию:**

   ```bash
   # Откройте файл
   nano .claude/hooks/config.sh

   # Найдите строку
   export LINEAR_TEAM_ID=""

   # Замените на ваш Team ID
   export LINEAR_TEAM_ID="your-team-id-here"
   ```

3. **Сохраните и закройте** (Ctrl+O, Enter, Ctrl+X)

4. **Протестируйте:**
   ```bash
   source .claude/hooks/config.sh
   echo $LINEAR_TEAM_ID
   ```

### Управление интеграциями

Все настройки в файле `.claude/hooks/config.sh`:

```bash
# Включить/выключить интеграции
export ENABLE_GITHUB=true      # GitHub integration
export ENABLE_LINEAR=true      # Linear integration
export ENABLE_CONTEXT7=true    # Context7 docs

# Feature flags
export AUTO_CREATE_BUG_ISSUES=true        # Auto GitHub issues при ошибках
export AUTO_CREATE_LINEAR_TASKS=true     # Auto Linear tasks при начале работы
export AUTO_PR_COMMENTS=false             # Auto comments в PR
export AUTO_FETCH_DOCS=false              # Auto документация при импорте
```

## 🧪 Тестирование интеграций

### Test GitHub Integration

```bash
# Создать тестовый issue
gh issue create --repo psyclr/youboost --title "Test Issue" --body "Testing MCP integration"

# Посмотреть все issues
gh issue list --repo psyclr/youboost
```

### Test Linear Integration (если настроено)

Linear интеграция будет автоматически срабатывать когда Claude начинает новую задачу.

### Test Context7

Context7 работает автоматически - Claude получает документацию по мере необходимости.

## 🎯 Примеры использования

### Создание задачи с автоматическим Linear tracking

```
Пользователь: "Создай Auth Service"
Claude: 🚀 Starting task: Создай Auth Service
        📋 Creating Linear issue... ✓ Linear task created
```

### Автоматический bug report в GitHub

При возникновении ошибки автоматически создается GitHub issue с:

- Описанием ошибки
- Полным контекстом
- Timestamp
- Label: `bug, automated`

### Code Review с автоматическими комментариями

```bash
# При review автоматически проверяется:
- ESLint
- TypeScript types
- Test coverage
- Security audit
- Complexity analysis

# И создается PR comment с результатами (если включено)
```

## 📚 Документация

- **Hooks README**: [.claude/hooks/README.md](.claude/hooks/README.md)
- **Project Instructions**: [.claude/instructions.md](.claude/instructions.md)
- **GitHub Repo**: [github.com/psyclr/youboost](https://github.com/psyclr/youboost)

## 🔧 Troubleshooting

### Hooks не работают

```bash
# Проверьте права на выполнение
chmod +x .claude/hooks/*

# Проверьте конфигурацию
source .claude/hooks/config.sh
echo $GITHUB_REPO
```

### GitHub MCP не работает

```bash
# Проверьте что GitHub MCP сервер установлен
# В Claude Code: Settings → MCP Servers → GitHub

# Проверьте GitHub CLI
gh --version
```

### Linear MCP не работает

```bash
# Проверьте Linear API key в настройках MCP
# В Claude Code: Settings → MCP Servers → Linear

# Проверьте Team ID
source .claude/hooks/config.sh
echo $LINEAR_TEAM_ID
```

## 🎉 Готово!

Все интеграции настроены и активны. Claude Code теперь автоматически:

- 📋 Создает задачи в Linear (если настроено)
- 🐛 Создает bug reports в GitHub
- ✅ Трекает завершенные задачи
- 📚 Получает документацию
- 🔍 Выполняет code review
- 📝 Сохраняет планы

Начните разработку и наслаждайтесь автоматизацией! 🚀
