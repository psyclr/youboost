#!/bin/bash

# Запускается автоматически при:
# - pre-commit (проверка изменений)
# - post-commit (обновление "Недавние изменения")
# - post-merge (синхронизация после merge)

CLAUDE_MD=".claude.md"

# Обновить раздел "Последнее обновление"
update_last_modified() {
    if [ -f "$CLAUDE_MD" ]; then
        sed -i '' "s/Последнее обновление: .*/Последнее обновление: $(date +%Y-%m-%d)/" $CLAUDE_MD
    fi
}

# Добавить в "Недавние изменения"
add_recent_change() {
    if [ -f "$CLAUDE_MD" ]; then
        local commit_msg=$(git log -1 --pretty=%B)
        local commit_date=$(git log -1 --pretty=%ad --date=short)
        local commit_hash=$(git log -1 --pretty=%h)

        # Добавить в начало секции "Недавние изменения"
        sed -i '' "/## 📝 Недавние изменения/a\\
- [$commit_date] ($commit_hash) $commit_msg
" $CLAUDE_MD
    fi
}

# Проверить, требуется ли обновление архитектуры
check_architecture_changes() {
    # Если изменены файлы в services/, предложить обновить секцию микросервисов
    if git diff --cached --name-only | grep -q "^services/"; then
        echo "⚠️  Обнаружены изменения в микросервисах. Рассмотрите обновление секции '📦 Микросервисы' в .claude.md"
    fi
    return 0
}

# Основная логика
case "$1" in
    "pre-commit")
        check_architecture_changes
        ;;
    "post-commit")
        update_last_modified
        add_recent_change
        ;;
    "merge")
        update_last_modified
        ;;
esac
