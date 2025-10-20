# 📱 WhatsApp Bot - Sistema por Número de Telefone

## 🎯 **"Login" por Número (Simulado)**

Embora não seja possível fazer login direto com número no WhatsApp Web, criamos um sistema que **simula** essa funcionalidade usando sessões nomeadas por número.

## 🚀 **Como funciona:**

1. **Primeira vez:** QR Code é necessário
2. **Sessão salva** com nome do número
3. **Próximas vezes:** Conecta automaticamente
4. **Múltiplos números** suportados

## 📋 **Uso Interativo:**

### **Método 1 - Script Interativo (Recomendado):**

```bash
# Linux/Mac
node start-by-number.js

# Windows PowerShell
.\start-by-number.ps1

# Ou via npm
npm run start:number
```

### **Método 2 - Direto com número:**

```bash
# Linux/Mac
WHATSAPP_PHONE=5511999999999 node index.js

# Windows PowerShell
$env:WHATSAPP_PHONE="5511999999999"; node index.js

# Ou via script
.\start-by-number.ps1 5511999999999
```

## 🎮 **Fluxo Interativo:**

```
📱 WhatsApp Bot - Configurador por Número
==========================================

📋 Sessões existentes encontradas:
   1. 5511999999999
   2. 5511888888888

Escolha: (1) Usar sessão existente, (2) Nova sessão, (3) Listar detalhes: 1

Qual sessão usar? (1-2): 1

✅ Usando sessão: 5511999999999
🚀 Iniciando bot para número: 5511999999999
✅ Sessão existente encontrada - conectando automaticamente!
🚫 QR Code NÃO será necessário!
```

## 📁 **Estrutura de Sessões:**

```
projeto/
├── sessions/
│   ├── whatsapp-bot-5511999999999/  # Sessão do número 1
│   │   ├── session.json
│   │   └── auth_info/
│   ├── whatsapp-bot-5511888888888/  # Sessão do número 2
│   │   ├── session.json
│   │   └── auth_info/
│   └── whatsapp-bot-default/        # Sessão padrão
└── index.js
```

## 🔧 **Comandos Principais:**

```bash
# Iniciar modo interativo
npm run start:number

# Usar número específico
WHATSAPP_PHONE=5511999999999 npm start

# Listar sessões existentes
ls -la sessions/

# Limpar sessão específica
rm -rf sessions/whatsapp-bot-5511999999999

# Exportar sessão de um número
WHATSAPP_PHONE=5511999999999 EXPORT_SESSION=true node index.js
```

## 🎯 **Vantagens desta abordagem:**

### ✅ **Organização por número:**
- Cada número tem sua própria sessão
- Fácil identificação e gerenciamento
- Backup individual por número

### ✅ **Múltiplos números:**
- Suporte a vários números WhatsApp
- Troca rápida entre contas
- Sessões isoladas e seguras

### ✅ **Interface amigável:**
- Scripts interativos
- Listagem de sessões
- Escolha visual das opções

### ✅ **Compatibilidade total:**
- Funciona local, Docker e Render
- Mantém todas as funcionalidades
- Sistema de backup preservado

## 🔄 **Fluxo de Primeira Configuração:**

### **1. Execute o configurador:**
```bash
npm run start:number
```

### **2. Digite seu número:**
```
📱 Digite seu número de WhatsApp (ex: 5511999999999): 5511999999999
⚠️ Nova sessão - QR Code será necessário UMA vez
💾 Após escanear, este número conectará automaticamente
Continuar? (s/N): s
```

### **3. Escaneie o QR Code que aparecer**

### **4. Próximas execuções:**
```bash
npm run start:number
# Escolha opção 1 - Usar sessão existente
# ✅ Conecta automaticamente!
```

## 🐳 **Docker com múltiplos números:**

```bash
# Volume para todas as sessões
docker volume create whatsapp-sessions

# Executar com número específico
docker run -d \
  --name whatsapp-5511999999999 \
  --restart unless-stopped \
  -v whatsapp-sessions:/app/sessions \
  -e WHATSAPP_PHONE=5511999999999 \
  -e EMAIL_PADRAO=samal@cs-consoft.com.br \
  bot-whatsapp
```

## 🌐 **Render com número:**

```yaml
envVars:
  - key: WHATSAPP_PHONE
    value: "5511999999999"
  - key: EMAIL_PADRAO
    value: samal@cs-consoft.com.br
```

## 🛠️ **Gerenciamento de Sessões:**

### **Listar sessões detalhadas:**
```bash
npm run start:number
# Escolha opção 3 - Listar detalhes
```

### **Backup de sessão específica:**
```bash
# Exportar
WHATSAPP_PHONE=5511999999999 EXPORT_SESSION=true node index.js

# Importar em outro local
WHATSAPP_SESSION_DATA=$(cat session-export.txt) \
WHATSAPP_PHONE=5511999999999 \
node index.js
```

### **Limpar sessão corrompida:**
```bash
# Linux/Mac
rm -rf sessions/whatsapp-bot-5511999999999

# Windows
Remove-Item -Recurse -Force sessions/whatsapp-bot-5511999999999
```

## 🎉 **Resultado Final:**

- 🔢 **"Login" por número** (via sessões nomeadas)
- 📱 **Múltiplos números** suportados
- 🚫 **QR Code apenas na primeira vez** por número
- 🔄 **Troca rápida** entre contas
- 💾 **Backup individual** por número
- 🎮 **Interface amigável** e interativa

**Agora você pode "usar números" para conectar!** 📱✨