FROM node:18-alpine

WORKDIR /app

# Instalar dependências completas para Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Copiar e instalar
COPY package*.json ./
RUN npm install

COPY . .

# Configurar Chromium com argumentos necessários
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV CHROME_PATH=/usr/bin/chromium-browser

EXPOSE 3005

CMD ["node", "index.js"]