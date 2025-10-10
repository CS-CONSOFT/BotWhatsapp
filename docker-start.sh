#!/bin/sh

echo "🐳 Iniciando Bot WhatsApp no Docker..."
echo "📅 Data/Hora: $(date)"

# Função para limpar arquivos temporários e processos pendentes
cleanup_session() {
    echo "🧹 Verificando e limpando sessão anterior..."
    
    # Aguardar um pouco para garantir que processos anteriores finalizaram
    sleep 2
    
    # Verificar se existe sessão anterior
    if [ -d "/app/.wwebjs_auth" ]; then
        echo "📁 Sessão anterior encontrada"
        
        # Tentar encontrar e finalizar processos que possam estar usando o diretório
        if command -v lsof >/dev/null 2>&1; then
            echo "🔍 Verificando processos usando o diretório de sessão..."
            PROCESSES=$(lsof +D /app/.wwebjs_auth 2>/dev/null | awk 'NR>1 {print $2}' | sort -u)
            if [ ! -z "$PROCESSES" ]; then
                echo "⚠️  Processos encontrados usando a sessão: $PROCESSES"
                for PID in $PROCESSES; do
                    echo "🔄 Finalizando processo $PID..."
                    kill -TERM $PID 2>/dev/null || true
                done
                sleep 3
                # Forçar finalização se necessário
                for PID in $PROCESSES; do
                    if kill -0 $PID 2>/dev/null; then
                        echo "💀 Forçando finalização do processo $PID..."
                        kill -KILL $PID 2>/dev/null || true
                    fi
                done
                sleep 2
            fi
        fi
        
        # Método de limpeza mais agressivo para Docker
        echo "🗑️  Removendo arquivos de sessão anterior..."
        
        # Primeiro, tentar remoção normal
        if ! rm -rf /app/.wwebjs_auth/* 2>/dev/null; then
            echo "⚠️  Remoção normal falhou, tentando método alternativo..."
            
            # Método alternativo: mover para backup e criar novo
            BACKUP_DIR="/app/.wwebjs_auth_backup_$(date +%s)"
            if mv /app/.wwebjs_auth "$BACKUP_DIR" 2>/dev/null; then
                echo "📦 Sessão movida para backup: $(basename $BACKUP_DIR)"
                mkdir -p /app/.wwebjs_auth
                chmod 755 /app/.wwebjs_auth
                # Limpar backup em background após alguns segundos
                (sleep 30 && rm -rf "$BACKUP_DIR" 2>/dev/null &) &
            else
                echo "⚠️  Não foi possível mover sessão, continuando mesmo assim..."
                mkdir -p /app/.wwebjs_auth
                chmod 755 /app/.wwebjs_auth
            fi
        else
            echo "✅ Arquivos de sessão removidos com sucesso"
        fi
    else
        echo "ℹ️  Nenhuma sessão anterior encontrada"
        mkdir -p /app/.wwebjs_auth
        chmod 755 /app/.wwebjs_auth
    fi
}

# Função para verificar se o diretório está acessível
check_auth_dir() {
    if [ ! -w "/app/.wwebjs_auth" ]; then
        echo "❌ Diretório de sessão não está acessível para escrita"
        echo "🔧 Tentando corrigir permissões..."
        chmod 755 /app/.wwebjs_auth 2>/dev/null || true
    fi
    
    # Teste de escrita
    TEST_FILE="/app/.wwebjs_auth/.test_write"
    if echo "test" > "$TEST_FILE" 2>/dev/null; then
        rm -f "$TEST_FILE" 2>/dev/null
        echo "✅ Diretório de sessão está acessível"
        return 0
    else
        echo "❌ Falha no teste de escrita do diretório"
        return 1
    fi
}

# Executar limpeza de sessão
cleanup_session

# Verificar se o diretório está acessível
if ! check_auth_dir; then
    echo "⚠️  Problemas com diretório de sessão, mas continuando..."
fi

echo "🚀 Iniciando aplicação Node.js..."
echo "📱 O QR Code será gerado caso não exista sessão válida"

# Definir manipuladores de sinal para shutdown gracioso
trap 'echo "🛑 Recebido sinal de parada, finalizando aplicação..."; kill -TERM $PID; wait $PID' TERM INT

# Iniciar a aplicação Node.js em background
node index.js &
PID=$!

echo "🆔 PID da aplicação: $PID"
echo "✅ Bot WhatsApp iniciado com sucesso!"

# Aguardar a aplicação terminar
wait $PID
EXIT_CODE=$?

echo "🏁 Aplicação finalizada com código: $EXIT_CODE"
exit $EXIT_CODE