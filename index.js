// Utilitário de email
const { emailConfig, enviarEmail } = require('./emailUtil');

// Classe para gerenciar configuração e notificações por usuário
class BotHandler {
    constructor() {
        this.configState = new Map(); // chave: userId, valor: { modoConfig: bool }
        this.emailPorUsuario = new Map(); // chave: userId, valor: email
    }

    getUserId(message) {
        return message.author || message.from;
    }

    isConfigMode(userId) {
        const state = this.configState.get(userId);
        return typeof state === 'object' && state.modoConfig;
    }

    setConfigMode(userId, value) {
        this.configState.set(userId, { modoConfig: value });
    }

    getEmail(userId) {
        return this.emailPorUsuario.get(userId) || 'vazio';
    }

    setEmail(userId, email) {
        this.emailPorUsuario.set(userId, email);
    }

    async handleConfig(message, chat, userId) {
        const texto = message.body.trim();
        const state = this.configState.get(userId);
        if (texto === '1') {
            this.setConfigMode(userId, 'aguardandoEmail');
            await chat.sendMessage('Digite o novo email para receber notificações:');
            return true;
        }
        if (texto === '2') {
            this.setConfigMode(userId, false);
            await chat.sendMessage('Saindo do modo de configuração. Bot voltando ao modo normal.');
            return true;
        }
        if (state.modoConfig === 'aguardandoEmail') {
            if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto)) {
                this.setEmail(userId, texto);
                this.setConfigMode(userId, false);
                await chat.sendMessage(`Email atualizado para: ${texto}\nSaindo do modo de configuração.`);
            } else {
                await chat.sendMessage('Email inválido. Tente novamente ou envie 2 para sair.');
            }
            return true;
        }
        await chat.sendMessage('Opção inválida.\n1 - Definir email\n2 - Sair');
        return true;
    }

    async startConfig(message, chat, userId) {
        this.setConfigMode(userId, true);
        const emailAtual = this.getEmail(userId);
        await chat.sendMessage(`Email atual cadastrado: ${emailAtual}\nEscolha uma opção:\n1 - Definir email\n2 - Sair`);
    }

    async handleMedia(message, chat, userId) {
        let tipo = message.type === 'image' ? 'IMAGEM' : 'PDF';
        console.log(`[${chat.name || chat.id.user}] ${message.author || message.from}: Enviou uma ${tipo}.`);
        const emailDestino = this.emailPorUsuario.get(userId);
        if (!emailDestino) {
            await chat.sendMessage('Nenhum email cadastrado. Use #CONFIG para definir um email.');
            return;
        }
        try {
            // Baixa o arquivo da mensagem
            const media = await message.downloadMedia();
            if (!media) {
                await chat.sendMessage('Não foi possível baixar o arquivo para enviar por email.');
                return;
            }
            // Prepara o anexo
            const attachment = {
                filename: tipo === 'IMAGEM' ? 'imagem.jpg' : 'documento.pdf',
                content: Buffer.from(media.data, 'base64'),
                contentType: media.mimetype
            };
            await enviarEmail(
                emailDestino,
                `Nova mensagem (${tipo}) no chat ${chat.name || chat.id.user}`,
                `Você recebeu uma ${tipo} de ${message.author || message.from} no chat ${chat.name || chat.id.user}.`,
                attachment
            );
            await chat.sendMessage('Notificação enviada para o email cadastrado.');
        } catch (e) {
            await chat.sendMessage(`Erro ao enviar email: ${e.message}`);
        }
    }

    async handleDocument(message, chat) {
        await chat.sendMessage(`[${chat.name || chat.id.user}] ${message.author || message.from}: Enviou um DOCUMENTO (${message._data.mimetype}).`);
    }

    async handleInstrucao(chat) {
        await chat.sendMessage('TESTE-DE-BOT-PESSOAL_Envie uma imagem ou PDF para receber por email, ou envie #CONFIG para configurar seu email de notificação.');
    }
}

const botHandler = new BotHandler();

// Importa as classes necessárias do whatsapp-web.js e libs para QR Code e servidor web
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const { log } = require('console');
const app = express();
const PORT = 3000;


let ultimoQR = null; // Armazena o último QR gerado
let qrMostrado = false; // Controla se o QR já foi exibido

// Nome exato do grupo que será monitorado
const NOME_GRUPO = "GRUPO_X"; // Altere para o nome real do seu grupo

// Cria o cliente do WhatsApp com autenticação local (sessão salva em disco)
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/app/.wwebjs_auth'
    }),
    puppeteer: {
        executablePath: '/usr/bin/chromium-browser',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Evento disparado quando o QR Code deve ser exibido no terminal e salvo para web
client.on('qr', qr => {
    // if (qrMostrado) return;
    qrMostrado = true;
    ultimoQR = qr;
    qrcode.generate(qr, {small: true});
    console.log("Escaneie o QR Code acima com o WhatsApp (Aparelhos conectados).");
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

// Inicia o servidor web em todas as interfaces (necessário para Docker)
app.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const ifaces = os.networkInterfaces();
    let urls = [];
    Object.values(ifaces).forEach(ifaceList => {
        ifaceList.forEach(iface => {
            if (iface.family === 'IPv4' && !iface.internal) {
                urls.push(`http://${iface.address}:${PORT}/qr`);
            }
        });
    });
    if (urls.length === 0) {
        urls.push(`http://localhost:${PORT}/qr`);
    }
    console.log('Servidor web do QR Code rodando em:');
    urls.forEach(url => console.log(url));
});

// Evento disparado quando o bot está pronto para uso
client.on('ready', () => {
    qrMostrado = false; // Permite mostrar QR novamente se deslogar
    console.log('Bot está online!');
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
        
        // ❌ IGNORAR MENSAGENS DE GRUPO
        if (chat.isGroup) {
            console.log(`⏭️ IGNORANDO mensagem de grupo: "${chat.name}"`);
            console.log(`💬 Bot funciona APENAS em conversas privadas!`);
            return;
        }

        console.log(`✅ Processando mensagem privada...`);

        // REMOVER TODA LÓGICA DE CONFIGURAÇÃO DE EMAIL
        // Não mais verificar #CONFIG ou modo de configuração

        // Verificar se tem mídia
        if (message.hasMedia) {
            console.log('📎 Mensagem com mídia detectada!');
            console.log(`📋 Tipo de mídia: ${message.type}`);
            
            const media = await message.downloadMedia();
            console.log(`📊 Mídia baixada - Tipo: ${media.mimetype}, Tamanho: ${media.data.length} bytes`);
            
            if (media.mimetype.startsWith('image/') || media.mimetype === 'application/pdf') {
                console.log('✅ Tipo de arquivo aceito, processando...');
                
                const contact = await message.getContact();
                
                // EMAIL FIXO - SEMPRE PARA SAMAL
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
            
            // Responder com instruções simplificadas se for apenas texto
            if (message.body.toLowerCase().includes('help') || 
                message.body.toLowerCase().includes('ajuda') || 
                message.body === '?') {
                await handleInstrucao(chat);
            }
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

// Função de instruções simplificada (sem configuração de email)
async function handleInstrucao(chat) {
    const instrucoes = `🤖 *Bot WhatsApp Ativo*

📧 *Destino fixo:* samal@cs-consoft.com.br

📋 *Como usar:*
• Envie uma *imagem* ou *PDF* em conversa privada
• Adicione *texto junto com a imagem* para usar como título do email
• O arquivo será enviado automaticamente para o email configurado

⚠️ *Importante:* 
• Bot funciona APENAS em conversas privadas
• Não funciona em grupos
• Não é necessário configurar email - destino é fixo

✅ Pronto para receber seus arquivos!`;

    await chat.sendMessage(instrucoes);
}

client.initialize();