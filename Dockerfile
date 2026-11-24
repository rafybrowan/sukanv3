# ============================================================
# Dockerfile — Sukan River Tubing (opsional, untuk VPS / Fly.io / Coolify)
# Build:  docker build -t sukan-river-tubing .
# Run:    docker run -p 3000:3000 \
#           -e DATABASE_URL="file:/data/custom.db" \
#           -e ADMIN_SESSION_SECRET="$(openssl rand -hex 32)" \
#           -v sukan-data:/data \
#           sukan-river-tubing
# ============================================================

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci


FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# Output standalone Next.js (sudah berisi .next/static dan public
# karena script build menyalinnya ke dalam .next/standalone)
COPY --from=builder /app/.next/standalone ./
# node_modules lengkap agar `prisma db push` bisa dijalankan saat start
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p /data /app/db
EXPOSE 3000
# Inisialisasi skema database (idempoten) lalu jalankan server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
