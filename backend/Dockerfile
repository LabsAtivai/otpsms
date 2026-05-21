FROM node:20-alpine

WORKDIR /app

# Copiar package.json do backend
COPY backend/package*.json ./
RUN npm ci --production=false

# Copiar restante do backend
COPY backend/ .

# Gerar Prisma client e buildar TypeScript
RUN npx prisma generate
RUN npm run build

# Remover devDependencies
RUN npm prune --production

RUN mkdir -p logs

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
