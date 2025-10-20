# Dockerfile corrigido
FROM node:18-bullseye-slim

WORKDIR /app

RUN apt-get update && apt-get install -y chromium libnss3 libatk-bridge2.0-0 libgtk-3-0 \
    libx11-xcb1 libgbm1 libasound2 fonts-noto-color-emoji ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
ENV DOCKER_ENV=true

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
USER node
CMD ["node", "index.js"]
