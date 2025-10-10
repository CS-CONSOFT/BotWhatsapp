# Bot WhatsApp

Este bot WhatsApp pode ser executado tanto localmente quanto em Docker, detectando automaticamente o ambiente de execução.

## Funcionalidades

- Recebe imagens e PDFs via WhatsApp e envia por email
- Interface web para visualizar QR Code de autenticação
- Configuração de email por usuário
- Suporte a execução local e Docker

## Pré-requisitos

### Para execução local:
- Node.js 18+ instalado
- Chrome/Chromium instalado no sistema

### Para execução via Docker:
- Docker instalado

## Instalação e Configuração

### 1. Clone o repositório
```bash
git clone <repository-url>
cd BotWhatsapp
```

### 2. Instale as dependências (apenas para execução local)
```bash
npm install
```

### 3. Configure as variáveis de ambiente

Para execução local, copie o arquivo `.env.example` para `.env` e ajuste as configurações:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações de email:
```env
SMTP_HOST=seu-smtp-host.com
SMTP_PORT=587
SMTP_USER=seu-usuario@email.com
SMTP_PASS=sua-senha
PORT=3000
```

## Execução

### Execução Local

```bash
# Modo desenvolvimento
npm run dev

# Ou diretamente
npm start
```

### Execução via Docker

```bash
# Construir a imagem
npm run docker:build

# Executar o container (interativo)
npm run docker:run

# Ou executar em segundo plano
npm run docker:run-detached

# Para parar o container em segundo plano
npm run docker:stop
```

### Execução via Docker Compose (alternativa)

Crie um arquivo `docker-compose.yml`:
```yaml
version: '3.8'
services:
  botwhatsapp:
    build: .
    ports:
      - "3000:3000"
    environment:
      - SMTP_HOST=seu-smtp-host.com
      - SMTP_PORT=587
      - SMTP_USER=seu-usuario@email.com
      - SMTP_PASS=sua-senha
    volumes:
      - ./data:/app/.wwebjs_auth
```

Execute com:
```bash
docker-compose up -d
```

## Uso

1. **Acesse o QR Code**: Após iniciar o bot, acesse `http://localhost:3000/qr` para visualizar o QR Code
2. **Escaneie com WhatsApp**: Use o WhatsApp no celular para escanear o código
3. **Configure email**: Envie `#CONFIG` no chat privado com o bot para configurar seu email
4. **Envie arquivos**: Envie imagens ou PDFs para o bot recebê-los por email

## Comandos do Bot

- `#CONFIG` - Entra no modo de configuração para definir email
- Enviar imagem ou PDF - Recebe o arquivo por email
- Qualquer outro texto - Mostra instruções de uso

## Estrutura do Projeto

```
BotWhatsapp/
├── index.js          # Arquivo principal do bot
├── emailUtil.js       # Utilitário para envio de emails
├── package.json       # Dependências e scripts
├── Dockerfile         # Configuração Docker
├── .env.example       # Exemplo de variáveis de ambiente
└── README.md         # Este arquivo
```

## Detecção Automática de Ambiente

O bot detecta automaticamente se está executando em Docker ou localmente através de:
- Verificação da existência do arquivo `/.dockerenv`
- Verificação do conteúdo de `/proc/1/cgroup`
- Variável de ambiente `DOCKER_ENV`

Com base na detecção, ajusta automaticamente:
- Caminho de armazenamento da sessão WhatsApp
- Configurações do Puppeteer/Chromium
- Endereços de bind do servidor web

## Troubleshooting

### Erro de Chromium no Docker
Certifique-se de que o Docker tem recursos suficientes (memória) alocados.

### Erro de autenticação WhatsApp
Delete a pasta `.wwebjs_auth` e escaneie o QR Code novamente.

### Problemas de email
Verifique as configurações SMTP no arquivo `.env` ou nas variáveis de ambiente do Docker.