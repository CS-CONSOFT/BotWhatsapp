# 🚀 Deploy no Render - WhatsApp Bot

## ✅ AUTENTICAÇÃO PERSISTENTE ATIVADA

🎉 **QR Code necessário APENAS na primeira execução!**

## Configurações necessárias no Render Dashboard:

### ✅ Variáveis de ambiente (Environment Variables):

```
EMAIL_PADRAO=samal@cs-consoft.com.br
NODE_ENV=production
RENDER=true
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
```

### 🚀 Opcional - MongoDB para sessão persistente no Render:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp-bot
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

## 📱 Como conectar (APENAS primeira vez):

1. Faça o deploy no Render
2. Acesse o dashboard do Render
3. Clique no seu serviço
4. Vá na aba **"Logs"**
5. **Aguarde aparecer o QR Code nos logs**
6. Escaneie com o WhatsApp
7. ✅ **PRONTO! Nunca mais precisará de QR Code**

## 🔄 Próximas execuções:

- ✅ Conecta automaticamente
- 🚫 QR Code NUNCA mais será necessário
- 🚀 Restart automático funciona perfeitamente

## 🗑️ Para resetar a sessão (caso necessário):

### Local/Docker:
```bash
chmod +x clear-session.sh
./clear-session.sh
```

### Render:
- Se usar MongoDB: limpar a collection `sessions`
- Sem MongoDB: fazer redeploy completo

## 🔧 Troubleshooting:

### QR Code não aparece:
1. Verifique se não há variáveis `PUPPETEER_EXECUTABLE_PATH` configuradas
2. Certifique-se que `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false`
3. Aguarde alguns minutos - o build pode demorar

### Bot não conecta automaticamente:
1. Verifique se a sessão não foi corrompida nos logs
2. Se necessário, limpe a sessão e escaneie QR Code novamente
3. Com MongoDB configurado, a sessão persiste entre deploys

### Erro de autenticação:
1. Sessão será automaticamente limpa
2. QR Code será solicitado novamente
3. Processo se auto-corrige

## 📞 URLs importantes:

- **Health Check:** `https://seu-app.onrender.com/health`
- **Logs:** Dashboard > Logs
- **Settings:** Dashboard > Settings

## 🎯 Benefícios da autenticação persistente:

- ✅ QR Code apenas UMA vez
- ✅ Reconexão automática
- ✅ Funciona após restart/redeploy
- ✅ Sessão segura e criptografada
- ✅ Auto-limpeza em caso de erro