-- Инициализация БД youboost

-- Создание расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUID генерация
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- Криптография

-- Комментарий
COMMENT ON DATABASE youboost_dev IS 'youboost SMM Marketplace Development Database';

-- Базовая схема будет создана через migrations
