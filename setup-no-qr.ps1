# Configurador de Sessão WhatsApp - ZERO QR Code
# PowerShell Script para Windows

Write-Host "🔑 Configurador de Sessão WhatsApp - ZERO QR Code" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

if ($args.Count -eq 0) {
    Write-Host ""
    Write-Host "📋 Opções:" -ForegroundColor Yellow
    Write-Host "   1. Exportar sessão atual"
    Write-Host "   2. Importar sessão de arquivo"
    Write-Host "   3. Configurar variável de ambiente"
    Write-Host ""
    
    $opcao = Read-Host "Escolha uma opção (1-3)"
    
    switch ($opcao) {
        1 {
            Write-Host "📤 Exportando sessão atual..." -ForegroundColor Blue
            if (Test-Path "./wwebjs_auth") {
                # Configurar flag de exportação e executar
                $env:EXPORT_SESSION = "true"
                Start-Process "node" -ArgumentList "index.js" -PassThru | Out-Null
                
                Write-Host "⏳ Aguardando exportação... (30 segundos)" -ForegroundColor Yellow
                Start-Sleep -Seconds 30
                
                if (Test-Path "./session-export.txt") {
                    Write-Host "✅ Sessão exportada para: session-export.txt" -ForegroundColor Green
                    Write-Host "🔑 Use este arquivo para importar em outros locais"
                } else {
                    Write-Host "❌ Erro na exportação" -ForegroundColor Red
                }
            } else {
                Write-Host "❌ Nenhuma sessão encontrada para exportar" -ForegroundColor Red
                Write-Host "💡 Execute o bot primeiro e escaneie o QR Code"
            }
        }
        2 {
            $arquivoSessao = Read-Host "📁 Caminho do arquivo de sessão"
            if (Test-Path $arquivoSessao) {
                Write-Host "📥 Importando sessão de: $arquivoSessao" -ForegroundColor Blue
                
                $sessionData = Get-Content $arquivoSessao -Raw
                
                # Configurar variáveis de ambiente do usuário
                [Environment]::SetEnvironmentVariable("WHATSAPP_SESSION_DATA", $sessionData, "User")
                [Environment]::SetEnvironmentVariable("SKIP_QR_CODE", "true", "User")
                
                Write-Host "✅ Sessão configurada!" -ForegroundColor Green
                Write-Host "🔄 Reinicie o PowerShell"
                Write-Host "🚀 Próxima execução do bot será SEM QR Code!"
            } else {
                Write-Host "❌ Arquivo não encontrado: $arquivoSessao" -ForegroundColor Red
            }
        }
        3 {
            $sessionData = Read-Host "📋 Cole o conteúdo da sessão (base64)"
            if ($sessionData -ne "") {
                # Configurar variáveis de ambiente do usuário
                [Environment]::SetEnvironmentVariable("WHATSAPP_SESSION_DATA", $sessionData, "User")
                [Environment]::SetEnvironmentVariable("SKIP_QR_CODE", "true", "User")
                
                Write-Host "✅ Variável de ambiente configurada!" -ForegroundColor Green
                Write-Host "🔄 Reinicie o PowerShell"
                Write-Host "🚀 Próxima execução do bot será SEM QR Code!"
            } else {
                Write-Host "❌ Conteúdo vazio" -ForegroundColor Red
            }
        }
        default {
            Write-Host "❌ Opção inválida" -ForegroundColor Red
        }
    }
    
    exit
}

# Importar sessão de arquivo
$arquivoSessao = $args[0]

if (-not (Test-Path $arquivoSessao)) {
    Write-Host "❌ Arquivo não encontrado: $arquivoSessao" -ForegroundColor Red
    exit 1
}

Write-Host "📥 Importando sessão de: $arquivoSessao" -ForegroundColor Blue

# Ler conteúdo do arquivo
$sessionData = Get-Content $arquivoSessao -Raw

# Configurar variáveis de ambiente para esta sessão
$env:WHATSAPP_SESSION_DATA = $sessionData
$env:SKIP_QR_CODE = "true"

Write-Host "✅ Sessão carregada para esta execução!" -ForegroundColor Green
Write-Host "🚀 Executando bot SEM QR Code..." -ForegroundColor Blue

# Executar bot
node index.js