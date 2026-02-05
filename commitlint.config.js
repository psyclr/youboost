module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Новая функциональность
        'fix',      // Исправление бага
        'docs',     // Изменения в документации
        'style',    // Форматирование, не влияющее на код
        'refactor', // Рефакторинг кода
        'perf',     // Улучшение производительности
        'test',     // Добавление тестов
        'chore',    // Изменения в сборке или вспомогательных инструментах
        'revert',   // Откат изменений
        'ci',       // Изменения в CI/CD
      ],
    ],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 200],
  },
};
