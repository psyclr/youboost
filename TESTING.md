# Quick API Testing Guide

## 1. Start Infrastructure

```bash
npm run docker:up          # PostgreSQL + Redis
npm run db:migrate:deploy  # Apply migrations
npm run start:dev          # Start server on :3000
```

## 2. Health Check

```bash
curl http://localhost:3000/health
```

## 3. Auth

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","username":"testuser","password":"Test1234!"}'

# Login (save the token)
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"Test1234!"}' | jq -r '.accessToken')

# Check profile
curl http://localhost:3000/auth/me -H "Authorization: Bearer $TOKEN"
```

## 4. Public Catalog (no auth)

```bash
curl http://localhost:3000/catalog/services
curl http://localhost:3000/catalog/services?platform=YOUTUBE&type=VIEWS
```

## 5. Billing

```bash
# Balance
curl http://localhost:3000/billing/balance -H "Authorization: Bearer $TOKEN"

# Create deposit
curl -X POST http://localhost:3000/billing/deposit \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amount":100,"currency":"USD","paymentMethod":"crypto","cryptoCurrency":"USDT"}'

# List deposits
curl http://localhost:3000/billing/deposits -H "Authorization: Bearer $TOKEN"

# Transactions
curl http://localhost:3000/billing/transactions -H "Authorization: Bearer $TOKEN"
```

## 6. Orders

```bash
# Create order (needs serviceId from catalog + funded wallet)
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"serviceId":"<SERVICE_ID>","link":"https://youtube.com/watch?v=test","quantity":1000}'

# List orders
curl http://localhost:3000/orders -H "Authorization: Bearer $TOKEN"

# Cancel order
curl -X DELETE http://localhost:3000/orders/<ORDER_ID> -H "Authorization: Bearer $TOKEN"
```

## 7. Notifications

```bash
curl http://localhost:3000/notifications -H "Authorization: Bearer $TOKEN"
```

## 8. API Keys & Webhooks

```bash
# Create API key
curl -X POST http://localhost:3000/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"my-key"}'

# Create webhook
curl -X POST http://localhost:3000/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/webhook","events":["order.created","order.completed"]}'
```

## 9. Admin (requires ADMIN role)

```bash
# To make yourself admin, use Prisma Studio:
# npm run db:studio -> find your user -> change role to ADMIN

curl http://localhost:3000/admin/dashboard/stats -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/admin/users -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/admin/orders -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/admin/services -H "Authorization: Bearer $TOKEN"
```

## Run Tests

```bash
npm test              # All tests
npm run test:coverage # With coverage report
npm run typecheck     # TypeScript check
npm run lint          # ESLint
npm run validate      # All checks at once
```

## Notes

- Payments use a **stub gateway** -- deposits are created but need manual confirmation
- Email notifications use a **stub provider** -- logged to console instead of sent
- Providers use a **stub client** -- orders get fake external IDs
- All stubs are designed to be swapped for real implementations later
