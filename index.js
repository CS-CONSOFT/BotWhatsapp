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
let qrGerado = false; // Nova variável para controlar se já foi gerado

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
       // Só gera o QR uma vez por sessão
    if (qrGerado) return;
    
    qrGerado = true;
    qrMostrado = true;
    ultimoQR = qr;
    qrcode.generate(qr, {small: true});
    console.log("QR Code gerado! Escaneie com o WhatsApp (Aparelhos conectados).");
    console.log("Acesse o QR Code via web em uma das URLs mostradas acima.");
});

// Rota para exibir o QR Code como imagem na web
app.get('/qr', async (req, res) => {
    if (!ultimoQR) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>QR Code WhatsApp</title>
                <meta http-equiv="refresh" content="5">
            </head>
            <body>
                <h2>Aguardando QR Code...</h2>
                <p>O QR Code ainda não foi gerado ou o bot já está conectado.</p>
                <p>Esta página será atualizada automaticamente a cada 5 segundos.</p>
            </body>
            </html>
        `);
    }
    try {
        const qrImage = await QRCode.toDataURL(ultimoQR);
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>QR Code WhatsApp</title>
            </head>
            <body>
                <h2>Escaneie o QR Code abaixo:</h2>
                <img src="${qrImage}" style="max-width: 400px;" />
                <p><strong>Importante:</strong> Este QR Code é único para esta sessão.</p>
                <p>Após escanear, o bot estará conectado e não será necessário escanear novamente.</p>
            </body>
            </html>
        `);
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
      qrMostrado = false;
    qrGerado = false; // Reset para permitir novo QR se deslogar
    ultimoQR = null; // Limpa o QR quando conectado
    console.log('Bot está online!');
});

// Evento disparado para cada mensagem recebida

// Novo evento para quando a sessão é perdida
client.on('disconnected', (reason) => {
    console.log('Cliente desconectado:', reason);
    qrGerado = false; // Permite gerar novo QR
    qrMostrado = false;
    ultimoQR = null;
});

client.on('message', async message => {
    const chat = await message.getChat();
    // Só responde mensagens privadas (ignora grupos)
    console.log(chat.isGroup);
    
    if (chat.isGroup) {
        return;
    }
    console.log(chat);
    
    console.log(`Mensagem recebida de ${message.from}: ${message.body}`);
    const userId = botHandler.getUserId(message);

    // Checagem de modo de configuração
    if (botHandler.isConfigMode(userId)) {
        await botHandler.handleConfig(message, chat, userId);
        return;
    }

    // Ativação do modo de configuração
    if (message.body.trim().toUpperCase() === '#CONFIG') {
        await botHandler.startConfig(message, chat, userId);
        return;
    }

    // Checagem de mídia
    if (message.type === 'image' || (message.type === 'document' && message._data && message._data.mimetype === 'application/pdf')) {
        await botHandler.handleMedia(message, chat, userId);
        return;
    }

    // Outros documentos
    if (message.type === 'document') {
        await botHandler.handleDocument(message, chat);
        return;
    }

    // Qualquer outra mensagem
    await botHandler.handleInstrucao(chat);
});

client.initialize();