# Domain Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect youboost.com to this server (207.244.249.196) with HTTPS via Caddy and Let's Encrypt.

**Architecture:** Caddy runs on the host as a systemd service and reverse-proxies all traffic to the Next.js frontend container (port 3001). The frontend handles `/api/*` rewrites to the backend container (port 3000) internally via `next.config.ts`. No Docker changes needed.

**Tech Stack:** Ubuntu 24.04, Caddy 2, Docker Compose (already running), Let's Encrypt HTTP-01 challenge.

---

### Task 1: Add DNS records at your registrar

**Files:** None (registrar web UI)

DNS must point to the server before Caddy can get a certificate. Let's Encrypt verifies domain ownership over HTTP.

- [ ] **Step 1: Log in to your domain registrar**

  Open Namecheap / GoDaddy / Reg.ru and navigate to DNS management for your domain.

- [ ] **Step 2: Add A record for root domain**

  | Type | Host | Value           | TTL  |
  |------|------|-----------------|------|
  | A    | `@`  | `207.244.249.196` | Auto |

- [ ] **Step 3: Add A record for www**

  | Type | Host  | Value           | TTL  |
  |------|-------|-----------------|------|
  | A    | `www` | `207.244.249.196` | Auto |

- [ ] **Step 4: Wait for DNS propagation and verify**

  Run from the server (repeat until you see the IP):
  ```bash
  dig +short youboost.com
  ```
  Expected output:
  ```
  207.244.249.196
  ```

  Also verify www:
  ```bash
  dig +short www.youboost.com
  ```
  Expected output:
  ```
  207.244.249.196
  ```

  DNS can take 5–60 minutes. Do not proceed until both return `207.244.249.196`.

---

### Task 2: Open firewall ports 80 and 443

**Files:** None (system firewall)

Caddy needs port 80 for the Let's Encrypt HTTP-01 ACME challenge and port 443 for HTTPS traffic.

- [ ] **Step 1: Check current UFW status**

  ```bash
  sudo ufw status
  ```

- [ ] **Step 2: Allow HTTP and HTTPS**

  ```bash
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  ```

- [ ] **Step 3: Verify rules are active**

  ```bash
  sudo ufw status numbered
  ```

  Expected: entries for port 80 and 443 with `ALLOW IN`.

  If UFW is inactive, enable it first (ensure port 22 is allowed to avoid locking yourself out):
  ```bash
  sudo ufw allow 22/tcp
  sudo ufw enable
  ```

---

### Task 3: Install Caddy

**Files:** None (system package install)

- [ ] **Step 1: Add Caddy apt repository**

  ```bash
  sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  ```

- [ ] **Step 2: Install Caddy**

  ```bash
  sudo apt update && sudo apt install -y caddy
  ```

- [ ] **Step 3: Verify installation**

  ```bash
  caddy version
  ```

  Expected output (version may differ):
  ```
  v2.9.1 ...
  ```

  ```bash
  sudo systemctl status caddy
  ```

  Expected: service is loaded (it may show "active" or "inactive" — that's fine at this stage).

---

### Task 4: Write Caddyfile

**Files:**
- Modify: `/etc/caddy/Caddyfile`

Caddy's default config listens on port 80 with a placeholder site. Replace it entirely.

- [ ] **Step 1: Write the Caddyfile**

  ```bash
  sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
  youboost.com, www.youboost.com {
      reverse_proxy localhost:3001
  }
  EOF
  ```

- [ ] **Step 2: Validate the config**

  ```bash
  sudo caddy validate --config /etc/caddy/Caddyfile
  ```

  Expected output:
  ```
  Valid configuration
  ```

---

### Task 5: Start Caddy and obtain TLS certificate

**Files:** None

- [ ] **Step 1: Enable Caddy to start on boot**

  ```bash
  sudo systemctl enable caddy
  ```

- [ ] **Step 2: Reload Caddy with new config**

  ```bash
  sudo systemctl reload caddy
  ```

  If Caddy wasn't running, start it instead:
  ```bash
  sudo systemctl start caddy
  ```

- [ ] **Step 3: Check Caddy is running and healthy**

  ```bash
  sudo systemctl status caddy
  ```

  Expected: `Active: active (running)`

- [ ] **Step 4: Check Caddy logs for certificate acquisition**

  ```bash
  sudo journalctl -u caddy -n 50 --no-pager
  ```

  Look for lines like:
  ```
  obtaining certificate ... youboost.com
  certificate obtained successfully
  ```

  If you see ACME errors, DNS has not propagated yet — wait and retry `sudo systemctl reload caddy`.

---

### Task 6: Update CORS origin in .env

**Files:**
- Modify: `/root/smm/youboost/.env`

The backend currently allows only `http://localhost:3000,http://localhost:3001`. Production traffic comes from `https://youboost.com`.

- [ ] **Step 1: Update CORS_ORIGIN in .env**

  ```bash
  sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://youboost.com,https://www.youboost.com|' /root/smm/youboost/.env
  ```

  Verify the change:
  ```bash
  grep CORS_ORIGIN /root/smm/youboost/.env
  ```

  Expected:
  ```
  CORS_ORIGIN=https://youboost.com,https://www.youboost.com
  ```

---

### Task 7: Rebuild and restart backend container

**Files:** None (Docker rebuild)

The backend reads `CORS_ORIGIN` from `.env` via docker-compose at container start. No code changes needed — just restart with the new env value.

- [ ] **Step 1: Restart backend to pick up new CORS_ORIGIN**

  ```bash
  cd /root/smm/youboost && docker compose up -d --no-build backend
  ```

  (No rebuild needed — only env vars changed, not code.)

- [ ] **Step 2: Verify backend is healthy**

  ```bash
  docker compose ps backend
  ```

  Expected: `Up` in the STATUS column.

  ```bash
  docker compose logs backend --tail 20
  ```

  Expected: no errors, logs show server started on port 3000.

---

### Task 8: End-to-end verification

**Files:** None

- [ ] **Step 1: Verify HTTP redirects to HTTPS**

  ```bash
  curl -I http://youboost.com
  ```

  Expected response headers include:
  ```
  HTTP/1.1 301 Moved Permanently
  Location: https://youboost.com/
  ```

- [ ] **Step 2: Verify HTTPS returns the frontend**

  ```bash
  curl -s -o /dev/null -w "%{http_code}" https://youboost.com
  ```

  Expected:
  ```
  200
  ```

- [ ] **Step 3: Verify TLS certificate is valid**

  ```bash
  curl -v https://youboost.com 2>&1 | grep -E "SSL|certificate|issuer|subject"
  ```

  Expected: lines showing `Let's Encrypt` as issuer.

- [ ] **Step 4: Verify API responds through the domain**

  ```bash
  curl -s -o /dev/null -w "%{http_code}" https://youboost.com/api/catalog/services
  ```

  Expected:
  ```
  200
  ```

- [ ] **Step 5: Verify www redirects to root domain (optional)**

  ```bash
  curl -I https://www.youboost.com
  ```

  Expected: `200` (both `youboost.com` and `www.youboost.com` are listed in the Caddyfile, so both serve the app).

---

## Troubleshooting

**Certificate not issued / ACME errors:**
- DNS not propagated yet → `dig +short youboost.com` must return `207.244.249.196` before proceeding
- Port 80 blocked → `sudo ufw status`, ensure port 80 is allowed

**502 Bad Gateway:**
- Frontend container not running → `docker compose ps`, then `docker compose up -d frontend`

**CORS errors in browser:**
- Backend CORS not updated → `grep CORS_ORIGIN .env` and `docker compose logs backend | grep cors`

**Caddy won't start:**
- Port conflict → `sudo ss -tlnp | grep -E ':80|:443'`, kill conflicting process
