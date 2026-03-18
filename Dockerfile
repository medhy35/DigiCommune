# ── Étape 1 : Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Étape 2 : Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Copier uniquement ce qui est nécessaire
COPY --from=builder /app/build           ./build
COPY --from=builder /app/node_modules    ./node_modules
COPY --from=builder /app/package.json    ./package.json
COPY --from=builder /app/prisma          ./prisma
COPY --from=builder /app/scripts         ./scripts

# Répertoire pour les templates uploadés
RUN mkdir -p /app/data/templates

# Utilisateur non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# Lance les migrations Prisma + démarre l'app
CMD ["sh", "-c", "npx prisma migrate deploy && node build"]
