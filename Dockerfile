# Use a imagem oficial do Node.js com Alpine Linux para menor tamanho
FROM node:18-alpine

# Instala dependências necessárias para Puppeteer/Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Cria um usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && adduser -S botuser -u 1001 -G nodejs

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de dependências primeiro (para cache do Docker)
COPY package.json package-lock.json* ./

# Instala as dependências do Node.js
RUN npm ci --only=production && npm cache clean --force

# Copia o código fonte
COPY --chown=botuser:nodejs . .

# Define variáveis de ambiente para Docker
ENV DOCKER_ENV=true
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --no-first-run --no-zygote --single-process --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"

# Cria diretório para dados persistentes
RUN mkdir -p /app/data && chown -R botuser:nodejs /app/data

# Muda para o usuário não-root
USER botuser

# Porta não necessária - bot apenas no terminal

# Define o comando de inicialização usando dumb-init para sinais corretos
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]

# Healthcheck simples para verificar se o processo está rodando
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD pgrep -f "node index.js" || exit 1