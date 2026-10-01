# Jokko — image de production (overlay, tableau de bord, API, relais temps réel).
# docker build -t jokko . && docker run -p 8080:8080 -v jokko-data:/data --env-file .env jokko

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 JOKKO_DATA_DIR=/data
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# Comptes, paiements et sauvegardes vivent dans /data : monte un volume persistant.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/api/health > /dev/null || exit 1
CMD ["node", "dist-server/main.js"]
