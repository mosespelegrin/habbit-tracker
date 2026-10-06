# Stage 1: build the Angular client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: the Express server, which also serves the built client
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN npm --prefix server ci --omit=dev
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1
CMD ["node", "server/server.js"]
