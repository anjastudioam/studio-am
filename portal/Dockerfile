# --- build ---
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY server ./server
COPY client ./client
COPY vite.config.ts ./
RUN npm run build

# --- run ---
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY server/drizzle ./server/drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
