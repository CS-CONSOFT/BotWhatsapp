# 📱 Bot WhatsApp - Sistema por Número
# PowerShell Script para Windows

Write-Host "📱 WhatsApp Bot - Configurador por Número" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Função para listar sessões existentes
function Get-ExistingSessions {
    $sessionsDir = "./sessions"
    if (-not (Test-Path $sessionsDir)) {
        return @()
    }
    
    return Get-ChildItem $sessionsDir -Directory | ForEach-Object {
        $_.Name -replace 'whatsapp-bot-', ''
    }
}

# Função para iniciar bot
function Start-Bot {
    param(
        [string]$PhoneNumber,
        [bool]$SkipQR = $false
    )
    
    Write-Host "🚀 Iniciando bot para número: $PhoneNumber" -ForegroundColor Blue
    
    $env:WHATSAPP_PHONE = $PhoneNumber
    $env:PHONE_NUMBER = $PhoneNumber
    
    if ($SkipQR) {
        $env:SKIP_QR_CODE = "true"
    }
    
    try {
        node index.js
    } catch {
        Write-Host "❌ Erro ao executar bot: $_" -ForegroundColor Red
    }
}

# Função principal
function Main {
    $existingSessions = Get-ExistingSessions
    
    if ($existingSessions.Count -gt 0) {
        Write-Host "📋 Sessões existentes encontradas:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $existingSessions.Count; $i++) {
            Write-Host "   $($i + 1). $($existingSessions[$i])"
        }
        Write-Host ""
        
        $choice = Read-Host "Escolha: (1) Usar sessão existente, (2) Nova sessão, (3) Listar detalhes"
        
        switch ($choice) {
            "1" {
                if ($existingSessions.Count -eq 1) {
                    $phoneNumber = $existingSessions[0]
                    Write-Host "✅ Usando sessão: $phoneNumber" -ForegroundColor Green
                    Start-Bot -PhoneNumber $phoneNumber -SkipQR $true
                    return
                } else {
                    $sessionChoice = Read-Host "Qual sessão usar? (1-$($existingSessions.Count))"
                    $sessionIndex = [int]$sessionChoice - 1
                    
                    if ($sessionIndex -ge 0 -and $sessionIndex -lt $existingSessions.Count) {
                        $phoneNumber = $existingSessions[$sessionIndex]
                        Write-Host "✅ Usando sessão: $phoneNumber" -ForegroundColor Green
                        Start-Bot -PhoneNumber $phoneNumber -SkipQR $true
                        return
                    } else {
                        Write-Host "❌ Opção inválida" -ForegroundColor Red
                        exit 1
                    }
                }
            }
            "3" {
                Write-Host "`n📁 Detalhes das sessões:" -ForegroundColor Yellow
                foreach ($session in $existingSessions) {
                    $sessionPath = "./sessions/whatsapp-bot-$session"
                    if (Test-Path $sessionPath) {
                        $stats = Get-Item $sessionPath
                        Write-Host "   📱 $session"
                        Write-Host "      📅 Criada: $($stats.CreationTime.ToString('dd/MM/yyyy'))"
                        Write-Host "      🔄 Modificada: $($stats.LastWriteTime.ToString('dd/MM/yyyy'))"
                        Write-Host ""
                    }
                }
                
                $phoneNumber = Read-Host "Digite o número para usar (ou Enter para nova sessão)"
                
                if ($phoneNumber -and $existingSessions -contains $phoneNumber) {
                    Start-Bot -PhoneNumber $phoneNumber -SkipQR $true
                } elseif ($phoneNumber) {
                    Start-Bot -PhoneNumber $phoneNumber -SkipQR $false
                } else {
                    Main
                }
                return
            }
        }
    }
    
    # Nova sessão
    $phoneNumber = Read-Host "📱 Digite seu número de WhatsApp (ex: 5511999999999)"
    
    if (-not $phoneNumber -or $phoneNumber.Length -lt 10) {
        Write-Host "❌ Número inválido" -ForegroundColor Red
        exit 1
    }
    
    # Verificar se já existe sessão
    if ($existingSessions -contains $phoneNumber) {
        Write-Host "✅ Sessão existente encontrada - conectando automaticamente!" -ForegroundColor Green
        Start-Bot -PhoneNumber $phoneNumber -SkipQR $true
    } else {
        Write-Host "⚠️ Nova sessão - QR Code será necessário UMA vez" -ForegroundColor Yellow
        Write-Host "💾 Após escanear, este número conectará automaticamente"
        
        $confirm = Read-Host "Continuar? (s/N)"
        
        if ($confirm -eq "s" -or $confirm -eq "sim" -or $confirm -eq "S") {
            Start-Bot -PhoneNumber $phoneNumber -SkipQR $false
        } else {
            Write-Host "❌ Cancelado" -ForegroundColor Red
            exit 0
        }
    }
}

# Verificar argumentos
if ($args.Count -gt 0) {
    $phoneNumber = $args[0]
    Write-Host "📱 Usando número fornecido: $phoneNumber" -ForegroundColor Blue
    
    $existingSessions = Get-ExistingSessions
    if ($existingSessions -contains $phoneNumber) {
        Write-Host "✅ Sessão encontrada - conectando automaticamente!" -ForegroundColor Green
        Start-Bot -PhoneNumber $phoneNumber -SkipQR $true
    } else {
        Write-Host "⚠️ Primeira conexão para este número" -ForegroundColor Yellow
        Start-Bot -PhoneNumber $phoneNumber -SkipQR $false
    }
} else {
    Main
}