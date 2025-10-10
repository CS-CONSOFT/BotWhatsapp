#!/bin/sh
echo "🚀 Iniciando Bot WhatsApp..."

# Garantir permissões corretas
chmod -R 777 /app/.wwebjs_auth 2>/dev/null || true

# Iniciar aplicação
node index.js