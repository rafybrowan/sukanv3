FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci


FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p /data /app/db
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
