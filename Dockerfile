# ---- Imagen base ----
FROM node:20-slim AS base
# openssl es requerido por Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Dependencias ----
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Regenera el cliente por si cambio el schema al copiar
RUN npx prisma generate
EXPOSE 3001
# Aplica migraciones y arranca
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
