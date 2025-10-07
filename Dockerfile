# Use Node.js 20 Alpine para imagem menor
FROM node:20-alpine

# Instalar dependências necessárias para Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Criar diretório para sessão do WhatsApp e dar permissões DEPOIS de copiar
RUN mkdir -p /app/.wwebjs_auth && \
    chown -R node:node /app

# Expor porta do servidor web
EXPOSE 3000

# Variáveis de ambiente para Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Variáveis de ambiente SMTP (podem ser sobrescritas)
ENV SMTP_HOST=smtp.gmail.com \
    SMTP_PORT=587 \
    SMTP_USER="ggestaosalafacomp@gmail.com" \
    SMTP_PASS="mggo atxt fqfj ecxx"

# Mudar para usuário não-root por segurança
USER node

# Comando para iniciar o bot
CMD ["node", "index.js"]