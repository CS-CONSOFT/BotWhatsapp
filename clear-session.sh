#!/bin/bash

echo "🗑️ Limpando sessão do WhatsApp Bot..."

# Limpar sessão local
if [ -d "./wwebjs_auth" ]; then
    rm -rf ./wwebjs_auth
    echo "✅ Sessão local removida"
else
    echo "ℹ️ Nenhuma sessão local encontrada"
fi

# Limpar sessão Docker (se houver volume)
docker volume ls | grep whatsapp-bot-auth && {
    echo "🐳 Removendo volume Docker..."
    docker volume rm whatsapp-bot-auth
    echo "✅ Volume Docker removido"
}

echo "✅ Limpeza concluída!"
echo "🔄 Próxima execução solicitará QR Code novamente"