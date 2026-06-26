FROM node:22-alpine

RUN apk add --no-cache openssl ca-certificates && update-ca-certificates

ENV NODE_OPTIONS="--use-openssl-ca"
ENV NODE_EXTRA_CA_CERTS="/etc/ssl/certs/ca-certificates.crt"

WORKDIR /app

# Monorepo (npm workspaces): the root lockfile references the workspace manifests,
# so copy them, but install ONLY the root (backend) deps via --no-workspaces — the
# backend image doesn't need the frontend/blog-engine packages.
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY blog-engine/package.json ./blog-engine/
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci --no-workspaces

# tsconfig.json extends tsconfig.base.json — both are needed for the build.
COPY tsconfig.json tsconfig.base.json ./
COPY src ./src/

RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npx prisma generate
RUN npx tsc
RUN cp -r src/generated dist/generated

EXPOSE 3000

CMD ["node", "dist/index.js"]
