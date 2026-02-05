#!/bin/bash
# MCP Integrations Configuration
# Отредактируйте этот файл для настройки интеграций

# ============================================
# GitHub Integration
# ============================================
# Формат: owner/repository
# Пример: "username/youboost"
export GITHUB_REPO=""  # НАСТРОЙТЕ: укажите ваш репозиторий

# ============================================
# Linear Integration
# ============================================
# Team ID можно найти:
# 1. Откройте Linear
# 2. Зайдите в любую issue
# 3. URL будет вида: linear.app/TEAM_NAME/issue/...
# 4. Team ID = TEAM_NAME
# Или используйте Linear API для получения списка teams
export LINEAR_TEAM_ID=""  # НАСТРОЙТЕ: укажите ваш Team ID

# ============================================
# Context7 Integration
# ============================================
# Context7 работает автоматически через MCP
# Настройка не требуется

# ============================================
# Feature Flags (включить/отключить интеграции)
# ============================================
export ENABLE_GITHUB=true
export ENABLE_LINEAR=true
export ENABLE_CONTEXT7=true

# Auto-создание issues при ошибках
export AUTO_CREATE_BUG_ISSUES=true

# Auto-создание Linear tasks при начале работы
export AUTO_CREATE_LINEAR_TASKS=true

# Auto-комментарии в PR при code review
export AUTO_PR_COMMENTS=false

# Auto-получение документации при импорте библиотек
export AUTO_FETCH_DOCS=false
