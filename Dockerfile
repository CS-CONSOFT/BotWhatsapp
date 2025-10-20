FROM node:20-alpine

# Instalar dependências necessárias para Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Configurar variáveis de ambiente
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV DOCKER_ENV=true
ENV NODE_ENV=production

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001 -G nodejs && \
    chown -R botuser:nodejs /app

USER botuser

# Expor porta
EXPOSE 3000

# Comando para iniciar
CMD ["node", "index.js"]