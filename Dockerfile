FROM node:22-alpine

RUN apk add --no-cache openssl ca-certificates && update-ca-certificates

ENV NODE_OPTIONS="--use-openssl-ca"
ENV NODE_EXTRA_CA_CERTS="/etc/ssl/certs/ca-certificates.crt"

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src/

RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npx prisma generate
RUN npx tsc
RUN cp -r src/generated dist/generated

EXPOSE 3000

CMD ["node", "dist/index.js"]
