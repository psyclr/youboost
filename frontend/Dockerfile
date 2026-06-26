# Built from the REPO ROOT context (npm workspaces) — see docker-compose.yml.
FROM node:22-alpine

WORKDIR /app

# Root lockfile + all workspace manifests, then install only the frontend workspace.
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY blog-engine/package.json ./blog-engine/
# --ignore-scripts: the root `prepare: husky` lifecycle would run here but husky
# (a root dev-dep) isn't installed in this frontend-only image, and images don't
# need git hooks anyway.
RUN npm ci -w frontend --include-workspace-root=false --ignore-scripts

# frontend/tsconfig.json extends ../tsconfig.base.json.
COPY tsconfig.base.json ./
COPY frontend ./frontend/

ARG API_URL=http://backend:3000
ENV API_URL=${API_URL}

RUN npm run build -w frontend

EXPOSE 3001

CMD ["npm", "run", "start", "-w", "frontend", "--", "--port", "3001"]
