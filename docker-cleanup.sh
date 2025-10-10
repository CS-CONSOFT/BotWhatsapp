#!/bin/bash

# Script para limpeza completa de sessões WhatsApp em Docker
# Usado para resolver problemas de EBUSY e conflitos de sessão

echo "🧹 Iniciando limpeza completa do Bot WhatsApp..."
echo "📅 Data/Hora: $(date)"

# Função para verificar se está rodando como root/sudo
check_permissions() {
    if [ "$EUID" -ne 0 ]; then
        echo "❌ Este script precisa ser executado com privilégios de root (sudo)"
        exit 1
    fi
}

# Função para parar containers graciosamente
stop_containers() {
    echo "🛑 Parando containers do Bot WhatsApp..."
    
    # Encontrar containers relacionados ao bot
    CONTAINERS=$(docker ps -q --filter "name=bot_whatsapp")
    
    if [ ! -z "$CONTAINERS" ]; then
        echo "📦 Containers encontrados: $CONTAINERS"
        
        for CONTAINER in $CONTAINERS; do
            CONTAINER_NAME=$(docker ps --filter "id=$CONTAINER" --format "{{.Names}}")
            echo "🛑 Parando container: $CONTAINER_NAME ($CONTAINER)"
            
            # Parada gracioso com timeout
            timeout 30 docker stop "$CONTAINER" || {
                echo "💀 Timeout atingido, forçando parada do container $CONTAINER"
                docker kill "$CONTAINER" 2>/dev/null || true
            }
            
            # Remover container
            echo "🗑️  Removendo container: $CONTAINER"
            docker rm -f "$CONTAINER" 2>/dev/null || true
        done
    else
        echo "ℹ️  Nenhum container do bot encontrado em execução"
    fi
    
    # Verificar containers usando a porta 3005 (pode haver outros)
    echo "🔍 Verificando containers na porta 3005..."
    PORT_CONTAINERS=$(docker ps -q --filter "publish=3005")
    
    if [ ! -z "$PORT_CONTAINERS" ]; then
        echo "🛑 Removendo containers na porta 3005: $PORT_CONTAINERS"
        for CONTAINER in $PORT_CONTAINERS; do
            docker rm -f "$CONTAINER" 2>/dev/null || true
        done
    fi
}

# Função para limpar processos e portas
cleanup_processes() {
    echo "🔌 Verificando processos na porta 3005..."
    
    if command -v lsof >/dev/null 2>&1; then
        PROCESSES=$(lsof -t -i :3005 2>/dev/null)
        if [ ! -z "$PROCESSES" ]; then
            echo "💀 Finalizando processos na porta 3005: $PROCESSES"
            kill -TERM $PROCESSES 2>/dev/null || true
            sleep 5
            # Forçar se necessário
            REMAINING=$(lsof -t -i :3005 2>/dev/null)
            if [ ! -z "$REMAINING" ]; then
                echo "🔪 Forçando finalização: $REMAINING"
                kill -KILL $REMAINING 2>/dev/null || true
            fi
        fi
    else
        echo "⚠️  lsof não disponível, usando netstat..."
        if command -v netstat >/dev/null 2>&1; then
            PID=$(netstat -tulpn 2>/dev/null | grep :3005 | awk '{print $7}' | cut -d'/' -f1)
            if [ ! -z "$PID" ]; then
                echo "💀 Finalizando processo na porta 3005: $PID"
                kill -TERM "$PID" 2>/dev/null || true
                sleep 3
                kill -KILL "$PID" 2>/dev/null || true
            fi
        fi
    fi
}

# Função para limpar diretórios de sessão
cleanup_session_dirs() {
    echo "📁 Limpando diretórios de sessão..."
    
    # Encontrar diretórios de sessão em locais comuns
    SESSION_DIRS=(
        "./.wwebjs_auth"
        "/app/.wwebjs_auth"
        "./.wwebjs_auth_*"
        "/app/.wwebjs_auth_*"
    )
    
    for DIR_PATTERN in "${SESSION_DIRS[@]}"; do
        for DIR in $DIR_PATTERN; do
            if [ -d "$DIR" ]; then
                echo "🗑️  Processando diretório: $DIR"
                
                # Finalizar processos usando o diretório
                if command -v fuser >/dev/null 2>&1; then
                    echo "🔍 Verificando processos usando $DIR..."
                    fuser -k "$DIR" 2>/dev/null || true
                    sleep 2
                fi
                
                if command -v lsof >/dev/null 2>&1; then
                    PROCS=$(lsof +D "$DIR" 2>/dev/null | awk 'NR>1 {print $2}' | sort -u)
                    if [ ! -z "$PROCS" ]; then
                        echo "💀 Finalizando processos usando $DIR: $PROCS"
                        for PID in $PROCS; do
                            kill -TERM "$PID" 2>/dev/null || true
                        done
                        sleep 3
                        for PID in $PROCS; do
                            kill -KILL "$PID" 2>/dev/null || true
                        done
                    fi
                fi
                
                # Tentar remoção com diferentes métodos
                echo "🗑️  Removendo $DIR..."
                
                # Método 1: remoção direta
                if rm -rf "$DIR" 2>/dev/null; then
                    echo "✅ $DIR removido com sucesso"
                else
                    echo "⚠️  Remoção direta falhou, tentando método alternativo..."
                    
                    # Método 2: mover e remover
                    BACKUP_NAME="${DIR}_backup_$(date +%s)"
                    if mv "$DIR" "$BACKUP_NAME" 2>/dev/null; then
                        echo "📦 $DIR movido para $BACKUP_NAME"
                        # Tentar remover backup
                        (sleep 10 && rm -rf "$BACKUP_NAME" 2>/dev/null &) &
                    else
                        echo "❌ Não foi possível remover $DIR - pode estar em uso"
                        echo "🔧 Tentando método mais agressivo..."
                        
                        # Método 3: umount se for mount point
                        if mountpoint -q "$DIR" 2>/dev/null; then
                            echo "📌 $DIR é um mount point, tentando umount..."
                            umount -f "$DIR" 2>/dev/null || true
                            sleep 2
                            rm -rf "$DIR" 2>/dev/null || true
                        fi
                    fi
                fi
            fi
        done
    done
}

# Função para limpar volumes Docker
cleanup_docker_volumes() {
    echo "📦 Limpando volumes Docker órfãos..."
    
    # Remover volumes não utilizados
    docker volume prune -f 2>/dev/null || true
    
    # Verificar volumes específicos do bot
    BOT_VOLUMES=$(docker volume ls -q | grep -E "(wwebjs|whatsapp|bot)" 2>/dev/null || true)
    
    if [ ! -z "$BOT_VOLUMES" ]; then
        echo "🔍 Volumes relacionados ao bot encontrados: $BOT_VOLUMES"
        for VOLUME in $BOT_VOLUMES; do
            # Verificar se o volume está em uso
            if ! docker ps -a --filter "volume=$VOLUME" --format "{{.Names}}" | grep -q .; then
                echo "🗑️  Removendo volume não utilizado: $VOLUME"
                docker volume rm "$VOLUME" 2>/dev/null || true
            else
                echo "⚠️  Volume $VOLUME ainda está em uso"
            fi
        done
    fi
}

# Função para limpar imagens antigas
cleanup_images() {
    echo "🖼️  Limpando imagens Docker antigas..."
    
    # Remover imagens não utilizadas
    docker image prune -f 2>/dev/null || true
    
    # Remover imagens antigas do bot (manter apenas as 3 mais recentes)
    echo "🔍 Verificando imagens antigas do bot..."
    OLD_IMAGES=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "bot_whatsapp" | tail -n +4)
    
    if [ ! -z "$OLD_IMAGES" ]; then
        echo "🗑️  Removendo imagens antigas do bot:"
        echo "$OLD_IMAGES"
        echo "$OLD_IMAGES" | xargs -r docker rmi 2>/dev/null || true
    fi
}

# Função para verificar sistema após limpeza
verify_cleanup() {
    echo "🔍 Verificando sistema após limpeza..."
    
    # Verificar containers
    REMAINING_CONTAINERS=$(docker ps -a -q --filter "name=bot_whatsapp")
    if [ ! -z "$REMAINING_CONTAINERS" ]; then
        echo "⚠️  Containers remanescentes encontrados: $REMAINING_CONTAINERS"
    else
        echo "✅ Nenhum container do bot encontrado"
    fi
    
    # Verificar porta 3005
    if command -v lsof >/dev/null 2>&1; then
        if lsof -i :3005 2>/dev/null | grep -q .; then
            echo "⚠️  Porta 3005 ainda está em uso:"
            lsof -i :3005 2>/dev/null || true
        else
            echo "✅ Porta 3005 está livre"
        fi
    fi
    
    # Verificar diretórios de sessão
    if [ -d "./.wwebjs_auth" ] || [ -d "/app/.wwebjs_auth" ]; then
        echo "⚠️  Diretórios de sessão ainda existem"
    else
        echo "✅ Diretórios de sessão limpos"
    fi
}

# Execução principal
main() {
    echo "🚀 Iniciando limpeza completa..."
    
    check_permissions
    stop_containers
    cleanup_processes
    cleanup_session_dirs
    cleanup_docker_volumes
    cleanup_images
    verify_cleanup
    
    echo ""
    echo "✅ Limpeza completa finalizada!"
    echo "🔄 Agora você pode reiniciar o bot com segurança"
    echo "📅 Concluído em: $(date)"
}

# Executar apenas se chamado diretamente (não sourced)
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi