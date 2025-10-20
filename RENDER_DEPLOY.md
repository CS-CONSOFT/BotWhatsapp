# 🚀 Deploy no Render - WhatsApp Bot

## Configurações necessárias no Render Dashboard:

### ✅ Variáveis de ambiente (Environment Variables):

```
EMAIL_PADRAO=samal@cs-consoft.com.br
NODE_ENV=production
RENDER=true
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
```

### ❌ NÃO configurar estas variáveis:

```
PUPPETEER_EXECUTABLE_PATH
CHROME_BIN
GOOGLE_CHROME_BIN
```

## 📋 Configurações do serviço:

- **Build Command:** `npm install`
- **Start Command:** `node index.js`
- **Health Check Path:** `/health`
- **Auto-Deploy:** Sim

## 📱 Como ver o QR Code:

1. Acesse o dashboard do Render
2. Clique no seu serviço
3. Vá na aba **"Logs"**
4. Aguarde aparecer o QR Code nos logs
5. Escaneie com o WhatsApp

## 🔧 Troubleshooting:

Se o QR Code não aparecer:
1. Verifique se não há variáveis `PUPPETEER_EXECUTABLE_PATH` configuradas
2. Certifique-se que `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false`
3. Veja os logs para erros do Puppeteer
4. Reinicie o serviço se necessário

## 📞 URLs importantes:

- **Health Check:** `https://seu-app.onrender.com/health`
- **Logs:** Dashboard > Logs
- **Settings:** Dashboard > Settings