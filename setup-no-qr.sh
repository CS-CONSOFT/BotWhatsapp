#!/bin/bash

echo "🔑 Configurador de Sessão WhatsApp - ZERO QR Code"
echo "================================================"

# Verificar se foi passado um arquivo de sessão
if [ "$1" = "" ]; then
    echo "❌ Uso: $0 <arquivo-sessao.txt>"
    echo ""
    echo "📋 Opções:"
    echo "   1. Exportar sessão atual"
    echo "   2. Importar sessão de arquivo"
    echo "   3. Configurar variável de ambiente"
    echo ""
    read -p "Escolha uma opção (1-3): " opcao
    
    case $opcao in
        1)
            echo "📤 Exportando sessão atual..."
            if [ -d "./wwebjs_auth" ]; then
                # Executar bot com flag de exportação
                EXPORT_SESSION=true node index.js &
                PID=$!
                
                echo "⏳ Aguardando exportação... (30 segundos)"
                sleep 30
                kill $PID 2>/dev/null
                
                if [ -f "./session-export.txt" ]; then
                    echo "✅ Sessão exportada para: session-export.txt"
                    echo "🔑 Use este arquivo para importar em outros locais"
                else
                    echo "❌ Erro na exportação"
                fi
            else
                echo "❌ Nenhuma sessão encontrada para exportar"
                echo "💡 Execute o bot primeiro e escaneie o QR Code"
            fi
            ;;
        2)
            read -p "📁 Caminho do arquivo de sessão: " arquivo_sessao
            if [ -f "$arquivo_sessao" ]; then
                echo "📥 Importando sessão de: $arquivo_sessao"
                
                # Configurar variável de ambiente
                SESSION_DATA=$(cat "$arquivo_sessao")
                echo "export WHATSAPP_SESSION_DATA='$SESSION_DATA'" >> ~/.bashrc
                echo "export SKIP_QR_CODE='true'" >> ~/.bashrc
                
                echo "✅ Sessão configurada!"
                echo "🔄 Reinicie o terminal ou execute: source ~/.bashrc"
                echo "🚀 Próxima execução do bot será SEM QR Code!"
            else
                echo "❌ Arquivo não encontrado: $arquivo_sessao"
            fi
            ;;
        3)
            read -p "📋 Cole o conteúdo da sessão (base64): " session_data
            if [ "$session_data" != "" ]; then
                echo "export WHATSAPP_SESSION_DATA='$session_data'" >> ~/.bashrc
                echo "export SKIP_QR_CODE='true'" >> ~/.bashrc
                
                echo "✅ Variável de ambiente configurada!"
                echo "🔄 Reinicie o terminal ou execute: source ~/.bashrc"
                echo "🚀 Próxima execução do bot será SEM QR Code!"
            else
                echo "❌ Conteúdo vazio"
            fi
            ;;
        *)
            echo "❌ Opção inválida"
            ;;
    esac
    
    exit 0
fi

# Importar sessão de arquivo
ARQUIVO_SESSAO="$1"

if [ ! -f "$ARQUIVO_SESSAO" ]; then
    echo "❌ Arquivo não encontrado: $ARQUIVO_SESSAO"
    exit 1
fi

echo "📥 Importando sessão de: $ARQUIVO_SESSAO"

# Ler conteúdo do arquivo
SESSION_DATA=$(cat "$ARQUIVO_SESSAO")

# Configurar variáveis de ambiente
export WHATSAPP_SESSION_DATA="$SESSION_DATA"
export SKIP_QR_CODE="true"

echo "✅ Sessão carregada para esta execução!"
echo "🚀 Executando bot SEM QR Code..."

# Executar bot
node index.js