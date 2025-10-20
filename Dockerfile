FROM node:18-bullseye-slim

WORKDIR /app

# Instalar dependências do sistema com mais libs
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libgbm1 \
    libasound2 \
    fonts-noto-color-emoji \
    ca-certificates \
    libxss1 \
    libgconf-2-4 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Configurar variáveis de ambiente
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
ENV DOCKER_ENV=true

# Copiar e instalar dependências
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar código
COPY . .

# Criar diretório para sessão persistente
RUN mkdir -p /app/wwebjs_auth && chown node:node /app/wwebjs_auth

# Volume para persistir autenticação
VOLUME ["/app/wwebjs_auth"]

# Usar usuário node (não root)
USER node

# Comando de inicialização
CMD ["node", "index.js"]