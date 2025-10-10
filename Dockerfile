# Use Node.js 20 Alpine para imagem menor
FROM node:20-alpine

# Instalar dependências necessárias para Chromium e init system
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    tini \
    procps \
    lsof

# Usar tini como init process para lidar com sinais e processos zumbis
ENTRYPOINT ["/sbin/tini", "--"]

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Criar script de inicialização que limpa sessões antigas
COPY --chown=node:node docker-start.sh /app/docker-start.sh
RUN chmod +x /app/docker-start.sh

# Criar diretório para sessão do WhatsApp como volume
RUN mkdir -p /app/.wwebjs_auth && \
    chown -R node:node /app && \
    chmod -R 755 /app/.wwebjs_auth

# Declarar volume para persistir dados de autenticação
VOLUME ["/app/.wwebjs_auth"]

# Expor porta do servidor web
EXPOSE 3000

# Variáveis de ambiente para Chromium com argumentos de segurança
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    DOCKER_ENV=true \
    NODE_ENV=production

# Mudar para usuário não-root por segurança
USER node

# Usar script de inicialização que trata do EBUSY
CMD ["/app/docker-start.sh"]