# Domain Setup Design — youboost.com

**Date:** 2026-05-20  
**Server IP:** 207.244.249.196  
**OS:** Ubuntu 24.04 LTS  

## Goal

Connect the youboost application running in Docker Compose to the domain `youboost.com` with automatic HTTPS via Let's Encrypt.

## Architecture

```
Internet (443/80)
    → Caddy (host, systemd service)
        → Frontend Docker container (localhost:3001)
            → Backend Docker container (localhost:3000) via Next.js /api/* rewrites
```

Caddy is installed on the host (not in Docker) to handle TLS termination. The frontend Next.js app already proxies `/api/*` to the backend via `next.config.ts` rewrites, so no changes to routing logic are needed.

## Components

### 1. DNS Records

Add at domain registrar (Namecheap/GoDaddy/Reg.ru):

| Type  | Host  | Value             | TTL  |
|-------|-------|-------------------|------|
| A     | `@`   | `207.244.249.196` | Auto |
| A     | `www` | `207.244.249.196` | Auto |

Propagation: 5–60 minutes.

### 2. Caddy Installation

Install via apt on Ubuntu 24.04:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

### 3. Caddyfile

`/etc/caddy/Caddyfile`:
```
youboost.com, www.youboost.com {
    reverse_proxy localhost:3001
}
```

Caddy automatically:
- Obtains Let's Encrypt TLS certificate on first request
- Renews the certificate before expiry
- Redirects HTTP → HTTPS

### 4. Environment Variables

In `.env`, update CORS to restrict to the actual domain:
```
CORS_ORIGIN=https://youboost.com
```

Rebuild and restart backend after `.env` change:
```bash
docker compose up --build -d backend
```

### 5. Firewall

Ensure ports 80 and 443 are open (required for Let's Encrypt HTTP-01 challenge and HTTPS traffic):
```bash
sudo ufw allow 80
sudo ufw allow 443
```

## Data Flow

1. Browser → `https://youboost.com` → Caddy (port 443)
2. Caddy → `http://localhost:3001` (Next.js frontend container)
3. Browser JS calls `/api/auth/login` → Next.js rewrite → `http://backend:3000/auth/login`

## Error Handling

- If Let's Encrypt challenge fails: check DNS propagation (`dig youboost.com`) and firewall (ports 80/443 open)
- If 502 Bad Gateway: check Docker containers are running (`docker compose ps`)
- If CORS errors after deploy: verify `CORS_ORIGIN=https://youboost.com` in `.env` and backend restarted

## Implementation Steps

1. Add DNS A records at registrar
2. Open ports 80/443 on server firewall
3. Install Caddy
4. Write `/etc/caddy/Caddyfile`
5. Start Caddy (`sudo systemctl enable --now caddy`)
6. Update `.env` with `CORS_ORIGIN`
7. Rebuild backend container
8. Verify: `curl https://youboost.com` returns the app
