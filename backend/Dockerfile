# --- Etapa builder: compila TypeScript a dist/ -----------------------------
FROM node:20-slim AS builder
WORKDIR /app

# mongodb-memory-server (devDependency, solo se usa en tests) intenta bajar
# binarios de Mongo en el postinstall. No hace falta en build ni en runtime.
ENV MONGOMS_DISABLE_POSTINSTALL=1

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Etapa runtime: solo dependencias de producción + dist/ -----------------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
