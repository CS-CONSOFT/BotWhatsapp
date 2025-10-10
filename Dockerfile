FROM node:18-alpine

WORKDIR /app

# Instalar só o necessário
RUN apk add --no-cache chromium

# Copiar e instalar
COPY package*.json ./
RUN npm install

COPY . .

# Configurar Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 3000

CMD ["node", "index.js"]