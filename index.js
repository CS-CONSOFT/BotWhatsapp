// Carrega variáveis de ambiente do arquivo .env (apenas em ambiente local)
if (!process.env.DOCKER_ENV) {
    try {
        require('dotenv').config();
    } catch (err) {
        console.log('dotenv não encontrado, usando variáveis de ambiente do sistema');
    }
}

// Utilitário de email
const { emailConfig, enviarEmail } = require('./emailUtil');

// Importa as classes necessárias do whatsapp-web.js e libs para QR Code e servidor web
const { Client, LocalAuth, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const { log } = require('console');
const path = require('path');
const fs = require('fs');

// Detecta se está rodando no Docker
function isRunningInDocker() {
    try {
        return fs.existsSync('/.dockerenv') ||
            fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker') ||
            process.env.DOCKER_ENV === 'true';
    } catch (err) {
        return false;
    }
}

const IS_DOCKER = isRunningInDocker();
console.log(`Executando em: ${IS_DOCKER ? 'Docker' : 'Local'}`);

// Configurações baseadas no ambiente
const getConfig = () => {
    if (IS_DOCKER) {
        return {
            authStrategy: new NoAuth(), // Usar NoAuth no Docker para evitar problemas de permissão
            puppeteer: {
                headless: true,
                executablePath: '/usr/bin/chromium',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-sync',
                    '--mute-audio',
                    '--disable-ipc-flooding-protection',
                    '--window-size=1920,1080',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-features=TranslateUI',
                    '--disable-crash-reporter',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-extensions-http-throttling',
                    '--disable-client-side-phishing-detection'
                ],
                timeout: 60000
            }
        };
    } else {
        return {
            authStrategy: new LocalAuth({
                clientId: 'whatsapp-bot-csconsoft'
            })
        };
    }
};

const config = getConfig();

// Variáveis do servidor web
const app = express();
const PORT = process.env.PORT || 3000;
let ultimoQR = null;
let qrMostrado = false;

// Criar cliente com tratamento de erro
let client;

try {
    console.log('🔧 Configurações do cliente:', JSON.stringify(config, null, 2));
    client = new Client(config);
    console.log('✅ Cliente WhatsApp criado com sucesso!');
} catch (error) {
    console.error('❌ Erro ao criar cliente WhatsApp:', error.message);
    process.exit(1);
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    const errorMsg = reason?.message || reason;

    // Erros específicos que podemos ignorar com segurança
    const ignorePatterns = [
        'Protocol error (Target.setAutoAttach): Target closed',
        'Protocol error (Network.setUserAgentOverride): Session closed',
        'Protocol error (Runtime.callFunctionOn): Session closed',
        'Protocol error (Page.navigate): Session closed',
        'Target closed',
        'Session closed'
    ];

    const shouldIgnore = ignorePatterns.some(pattern =>
        String(errorMsg).includes(pattern)
    );

    if (shouldIgnore) {
        console.log('🔇 Erro de protocolo ignorado:', errorMsg);
        return;
    }

    console.log('⚠️ Unhandled Rejection:', errorMsg);
});

process.on('uncaughtException', (error) => {
    const errorMsg = error?.message || error;

    const ignorePatterns = [
        'Protocol error',
        'Session closed',
        'Target closed'
    ];

    const shouldIgnore = ignorePatterns.some(pattern =>
        String(errorMsg).includes(pattern)
    );

    if (shouldIgnore) {
        console.log('🔇 Exceção de protocolo ignorada:', errorMsg);
        return;
    }

    console.error('❌ EXCEÇÃO NÃO CAPTURADA:', errorMsg);
});

// Evento disparado quando o QR Code deve ser exibido
client.on('qr', qr => {
    console.log("🔄 Novo QR Code recebido!");
    qrMostrado = true;
    ultimoQR = qr;

    qrcode.generate(qr, { small: true });
    console.log("📱 QR Code gerado! Escaneie com o WhatsApp (Aparelhos conectados).");
    console.log("⏰ O QR Code expira em alguns minutos, se não funcionar, reinicie o bot.");
});

// Rota para exibir o QR Code como imagem na web
app.get('/qr', async (req, res) => {
    if (!ultimoQR) {
        return res.status(404).send('QR Code ainda não gerado. Aguarde...');
    }
    try {
        const qrImage = await QRCode.toDataURL(ultimoQR);
        res.send(`<!DOCTYPE html><html><head><title>QR Code WhatsApp</title></head><body><h2>Escaneie o QR Code abaixo:</h2><img src="${qrImage}" /><p>Atualize a página se necessário.</p></body></html>`);
    } catch (err) {
        res.status(500).send('Erro ao gerar QR Code');
    }
});

// Health check para o Render
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        bot_connected: client && client.info ? true : false
    });
});

// Servidor web
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor web rodando na porta ${PORT}`);
    if (IS_DOCKER) {
        console.log(`📱 QR Code disponível em: http://localhost:${PORT}/qr`);
    }
});

// Evento disparado quando o bot está pronto para uso
client.on('ready', async () => {
    qrMostrado = false;
    console.log('✅ Bot do WhatsApp está pronto e funcionando!');
    console.log('📱 Conectado como:', client.info.wid.user);
    console.log('📞 Nome:', client.info.pushname);
    console.log('💬 Pronto para receber mensagens PRIVADAS!');
    console.log('📧 Email destinatário: samal@cs-consoft.com.br');
    console.log('');
    console.log('📋 Como usar:');
    console.log('   • Envie uma imagem ou PDF em conversa privada');
    console.log('   • Adicione texto junto com a imagem para usar como título');
    console.log('   • Digite "ajuda" para ver instruções');
});

// Listeners adicionais para debug
client.on('loading_screen', (percent, message) => {
    console.log(`🔄 Carregando: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
    console.log('✅ Autenticado com sucesso!');
});

client.on('auth_failure', msg => {
    console.log('❌ Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
    console.log('🔌 Desconectado:', reason);
});

// Evento disparado para cada mensagem recebida
client.on('message', async message => {
    console.log('🔔 MENSAGEM RECEBIDA!');
    console.log(`📱 De ID: ${message.from}`);
    console.log(`💬 Conteúdo: "${message.body}"`);
    console.log(`📋 Tipo: ${message.type}`);
    console.log(`⏰ Timestamp: ${new Date(message.timestamp * 1000)}`);

    try {
        const chat = await message.getChat();
        console.log(`📁 Chat - Tipo: ${chat.isGroup ? 'GRUPO' : 'PRIVADO'}`);

        // Ignorar mensagens de grupo
        if (chat.isGroup) {
            console.log(`⏭️ IGNORANDO mensagem de grupo: "${chat.name}"`);
            console.log(`💬 Bot funciona APENAS em conversas privadas!`);
            return;
        }

        console.log(`✅ Processando mensagem privada...`);

        // Verificar se tem mídia
        if (message.hasMedia) {
            console.log('📎 Mensagem com mídia detectada!');
            console.log(`📋 Tipo de mídia: ${message.type}`);

            const media = await message.downloadMedia();
            console.log(`📊 Mídia baixada - Tipo: ${media.mimetype}, Tamanho: ${media.data.length} bytes`);

            if (media.mimetype.startsWith('image/') || media.mimetype === 'application/pdf') {
                console.log('✅ Tipo de arquivo aceito, processando...');

                const contact = await message.getContact();
                const emailDestino = 'samal@cs-consoft.com.br';

                console.log(`📧 Enviando para: ${emailDestino}`);
                console.log(`👤 De: ${contact.name || contact.pushname || 'Desconhecido'}`);

                // Preparar dados para envio
                const attachment = {
                    filename: media.mimetype.startsWith('image/') ? 'imagem.jpg' : 'documento.pdf',
                    content: Buffer.from(media.data, 'base64'),
                    contentType: media.mimetype
                };

                const assunto = message.body ? message.body.trim() : 'Arquivo enviado via WhatsApp';
                const corpo = `Você recebeu um arquivo de ${contact.name || contact.pushname || 'Usuário'} via WhatsApp Bot.`;

                try {
                    await message.reply("Enviando seu arquivo por email, aguarde...");
                    await enviarEmail(emailDestino, assunto, corpo, attachment);
                    console.log('✅ Email enviado com sucesso!');

                    const tipoArquivo = media.mimetype.startsWith('image/') ? 'Imagem' : 'PDF';

                    const mensagemConfirmacao = message.body
                        ? `✅ ${tipoArquivo} enviado para: ${emailDestino}\n📧 Título: "${message.body.trim()}"`
                        : `✅ ${tipoArquivo} enviado para: ${emailDestino}`;

                    await message.reply(mensagemConfirmacao);
                } catch (emailError) {
                    console.error('❌ Erro ao enviar email:', emailError);
                    await message.reply('❌ Erro ao enviar arquivo por email. Tente novamente.');
                }
            } else {
                console.log(`❌ Tipo de arquivo não suportado: ${media.mimetype}`);
                await message.reply('❌ Apenas imagens (JPG, PNG) e PDFs são aceitos.');
            }
        } else {
            console.log('💬 Mensagem sem mídia (apenas texto)');

                const instrucoes = `🤖 *Bot WhatsApp Ativo*

                📧 *Destino:* samal@cs-consoft.com.br

                📋 *Como usar:*
                • Envie uma *imagem* ou *PDF* em conversa privada
                • Adicione *texto junto com a imagem* para usar como título do email
                • O arquivo será enviado automaticamente

                ⚠️ *Importante:* 
                • Bot funciona APENAS em conversas privadas
                • Não funciona em grupos

                ✅ Pronto para receber seus arquivos!`;

                await message.reply(instrucoes);
        }

    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        console.error('📊 Stack trace:', error.stack);

        try {
            await message.reply('❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.');
        } catch (replyError) {
            console.error('❌ Erro ao enviar resposta de erro:', replyError);
        }
    }
});

// Função de instruções
async function handleInstrucao(chat) {
    const instrucoes = `🤖 *Bot WhatsApp Ativo*

📧 *Destino:* samal@cs-consoft.com.br

📋 *Como usar:*
• Envie uma *imagem* ou *PDF* em conversa privada
• Adicione *texto junto com a imagem* para usar como título do email
• O arquivo será enviado automaticamente

⚠️ *Importante:* 
• Bot funciona APENAS em conversas privadas
• Não funciona em grupos

✅ Pronto para receber seus arquivos!`;

    await chat.sendMessage(instrucoes);
}

console.log('🔧 Inicializando cliente WhatsApp...');
console.log('💬 Modo APENAS conversas privadas ativado');
console.log('🚫 Mensagens de grupo serão ignoradas');

// Delay para estabilizar no Docker
if (IS_DOCKER) {
    console.log('🐳 Ambiente Docker detectado - aguardando 3 segundos...');
    setTimeout(() => {
        client.initialize();
    }, 3000);
} else {
    client.initialize();
}