-- Инициализация БД youboost

-- Создание расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUID генерация
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- Криптография

-- Комментарий
COMMENT ON DATABASE youboost_dev IS 'youboost SMM Marketplace Development Database';

-- Создание тестовой БД
SELECT 'CREATE DATABASE youboost_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'youboost_test')\gexec

-- Базовая схема будет создана через migrations
