# Development Instructions — youboost

## Architecture Principles

1. **Modular monorepo** — each module in `src/modules/` is independent with its own routes, service, tests
2. **API-first** — all interaction through REST endpoints
3. **Security at every level** — validation, authentication, encryption
4. **Horizontal scalability** — stateless services, Redis for shared state

## Code Standards

- **TypeScript strict mode**: All strict options enabled, no-any, no-implicit-any
- **Functional style**: Prefer pure functions, minimize side effects
- **Immutability by default**: Use `const`, `readonly`, `Object.freeze` where possible
- **Explicit over implicit**: Explicit types, explicit error handling

## Git Workflow

### Branches

- `main` — production-ready code
- `feat/feature-name` — new features
- `fix/bug-name` — bug fixes
- `refactor/description` — refactoring

### Conventional Commits

Format: `type(scope): message`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:

```
feat(auth): add JWT authentication
fix(billing): resolve payment processing bug
```

### Pull Requests

- Code review required
- All CI checks must pass
- Coverage >= 80%
- Update docs if needed

## Testing

### Requirements

- **Unit tests**: 90% coverage target
- **Integration tests**: 70% coverage target
- **E2E tests**: Critical paths
- **Security tests**: OWASP Top 10

### TDD Approach

1. Write failing test
2. Write minimal code to pass
3. Refactor
4. Repeat

## Security

### Required

- Input validation on all endpoints
- SQL injection protection (parameterized queries via Prisma)
- XSS protection (escape outputs)
- Rate limiting (per-tier via Redis)
- Secrets in environment variables only
- API keys encrypted at rest (AES-256-GCM)

### Banned

- Hardcoded secrets in code
- `eval()` or equivalents
- Ignoring security warnings
- Committing `.env` files

## Performance

- API response time < 100ms (p95)
- Database queries optimized (indexes)
- Redis caching for frequently accessed data
- Pagination for large lists
- Avoid N+1 queries

## Code Review Checklist

Before creating a PR:

- [ ] All tests pass
- [ ] Coverage >= 80%
- [ ] ESLint clean
- [ ] TypeScript clean (`tsc --noEmit`)
- [ ] Prettier formatted
- [ ] No `console.log` or `debugger`
- [ ] No code duplication
- [ ] No security vulnerabilities
