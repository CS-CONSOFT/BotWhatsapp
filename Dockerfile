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

# Criar diretório para sessão do WhatsApp com permissões completas
RUN mkdir -p /app/.wwebjs_auth && \
    chown -R node:node /app && \
    chmod -R 777 /app/.wwebjs_auth

# Expor porta do servidor web
EXPOSE 3000

# Variáveis de ambiente para Chromium com argumentos de segurança
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    DOCKER_ENV=true

# Mudar para usuário não-root por segurança
USER node

# Comando para iniciar o bot
CMD ["node", "index.js"]