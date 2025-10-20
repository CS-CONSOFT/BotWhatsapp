#!/usr/bin/env node

/**
 * Inicializador do Bot WhatsApp por Número
 * Simula "login por número" usando sessões nomeadas
 */

const readline = require('readline');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('📱 WhatsApp Bot - Configurador por Número');
console.log('==========================================');
console.log('');

// Listar sessões existentes
function listExistingSessions() {
    const sessionsDir = './sessions';
    if (!fs.existsSync(sessionsDir)) {
        return [];
    }
    
    const sessions = fs.readdirSync(sessionsDir)
        .filter(dir => fs.statSync(path.join(sessionsDir, dir)).isDirectory())
        .map(dir => dir.replace('whatsapp-bot-', ''));
    
    return sessions;
}

function startBot(phoneNumber, skipQR = false) {
    console.log(`🚀 Iniciando bot para número: ${phoneNumber}`);
    
    const env = {
        ...process.env,
        WHATSAPP_PHONE: phoneNumber,
        PHONE_NUMBER: phoneNumber
    };
    
    if (skipQR) {
        env.SKIP_QR_CODE = 'true';
    }
    
    const botProcess = spawn('node', ['index.js'], {
        env: env,
        stdio: 'inherit'
    });
    
    botProcess.on('close', (code) => {
        console.log(`\n🏁 Bot finalizado com código: ${code}`);
        process.exit(code);
    });
    
    // Capturar Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n⏹️ Parando bot...');
        botProcess.kill();
    });
}

async function main() {
    const existingSessions = listExistingSessions();
    
    if (existingSessions.length > 0) {
        console.log('📋 Sessões existentes encontradas:');
        existingSessions.forEach((session, index) => {
            console.log(`   ${index + 1}. ${session}`);
        });
        console.log('');
        
        const choice = await new Promise(resolve => {
            rl.question('Escolha: (1) Usar sessão existente, (2) Nova sessão, (3) Listar detalhes: ', resolve);
        });
        
        if (choice === '1') {
            if (existingSessions.length === 1) {
                const phoneNumber = existingSessions[0];
                console.log(`✅ Usando sessão: ${phoneNumber}`);
                rl.close();
                startBot(phoneNumber, true);
                return;
            } else {
                const sessionChoice = await new Promise(resolve => {
                    rl.question(`Qual sessão usar? (1-${existingSessions.length}): `, resolve);
                });
                
                const sessionIndex = parseInt(sessionChoice) - 1;
                if (sessionIndex >= 0 && sessionIndex < existingSessions.length) {
                    const phoneNumber = existingSessions[sessionIndex];
                    console.log(`✅ Usando sessão: ${phoneNumber}`);
                    rl.close();
                    startBot(phoneNumber, true);
                    return;
                } else {
                    console.log('❌ Opção inválida');
                    process.exit(1);
                }
            }
        } else if (choice === '3') {
            console.log('\n📁 Detalhes das sessões:');
            existingSessions.forEach(session => {
                const sessionPath = `./sessions/whatsapp-bot-${session}`;
                const stats = fs.statSync(sessionPath);
                console.log(`   📱 ${session}`);
                console.log(`      📅 Criada: ${stats.birthtime.toLocaleDateString()}`);
                console.log(`      🔄 Modificada: ${stats.mtime.toLocaleDateString()}`);
                console.log('');
            });
            
            const phoneNumber = await new Promise(resolve => {
                rl.question('Digite o número para usar (ou Enter para nova sessão): ', resolve);
            });
            
            rl.close();
            
            if (phoneNumber && existingSessions.includes(phoneNumber)) {
                startBot(phoneNumber, true);
            } else if (phoneNumber) {
                startBot(phoneNumber, false);
            } else {
                main();
            }
            return;
        }
    }
    
    // Nova sessão
    const phoneNumber = await new Promise(resolve => {
        rl.question('📱 Digite seu número de WhatsApp (ex: 5511999999999): ', resolve);
    });
    
    if (!phoneNumber || phoneNumber.length < 10) {
        console.log('❌ Número inválido');
        rl.close();
        process.exit(1);
    }
    
    // Verificar se já existe sessão para este número
    if (existingSessions.includes(phoneNumber)) {
        console.log('✅ Sessão existente encontrada - conectando automaticamente!');
        rl.close();
        startBot(phoneNumber, true);
    } else {
        console.log('⚠️ Nova sessão - QR Code será necessário UMA vez');
        console.log('💾 Após escaneaar, este número conectará automaticamente');
        
        const confirm = await new Promise(resolve => {
            rl.question('Continuar? (s/N): ', resolve);
        });
        
        rl.close();
        
        if (confirm.toLowerCase() === 's' || confirm.toLowerCase() === 'sim') {
            startBot(phoneNumber, false);
        } else {
            console.log('❌ Cancelado');
            process.exit(0);
        }
    }
}

main().catch(console.error);