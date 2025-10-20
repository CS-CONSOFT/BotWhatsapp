const http = require('http');

// Criar servidor HTTP simples para health check
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            bot_connected: client && client.info ? true : false
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Health check server rodando na porta ${PORT}`);
});

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
        return state && (state.modoConfig === true || state.modoConfig === 'aguardandoEmail');
    }

    setConfigMode(userId, value) {
        this.configState.set(userId, { modoConfig: value });
    }

    getEmail(userId) {
        // Sempre retorna o email padrão, mas permite configuração personalizada se existir
        return this.emailPorUsuario.get(userId) || 'samal@cs-consoft.com.br';
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
        const emailPersonalizado = this.emailPorUsuario.get(userId);
        const emailAtual = this.getEmail(userId);
        const isDefault = !emailPersonalizado;
        const status = isDefault ? '(padrão do sistema)' : '(personalizado)';
        await chat.sendMessage(`Email atual: ${emailAtual} ${status}\nEscolha uma opção:\n1 - Definir email personalizado\n2 - Sair`);
    }

    async handleMedia(message, chat, userId) {
        let tipo = message.type === 'image' ? 'IMAGEM' : 'PDF';
        console.log(`[${chat.name || chat.id.user}] ${message.author || message.from}: Enviou uma ${tipo}.`);

        // Captura o texto/legenda da mensagem
        const textoMensagem = message.body ? message.body.trim() : '';
        console.log(`[DEBUG] Texto da mensagem: "${textoMensagem}"`);

        const emailDestino = this.getEmail(userId); // Usa a função getEmail que já tem o email padrão
        console.log(`[DEBUG] Processando ${tipo} para envio para: ${emailDestino}`);

        try {
            // Baixa o arquivo da mensagem
            console.log(`[DEBUG] Tentando baixar mídia...`);
            const media = await message.downloadMedia();
            if (!media) {
                console.log(`[ERRO] Não foi possível baixar mídia`);
                await chat.sendMessage('Não foi possível baixar o arquivo para enviar por email.');
                return;
            }
            console.log(`[DEBUG] Mídia baixada com sucesso. MimeType: ${media.mimetype}`);

            // Prepara o anexo
            const attachment = {
                filename: tipo === 'IMAGEM' ? 'imagem.jpg' : 'documento.pdf',
                content: Buffer.from(media.data, 'base64'),
                contentType: media.mimetype
            };

            // Define o título do email baseado no texto da mensagem
            let tituloEmail;
            let corpoEmail;

            if (textoMensagem) {
                tituloEmail = textoMensagem;
                corpoEmail = `Você recebeu uma ${tipo} de ${message.author || message.from} no chat ${chat.name || chat.id.user}.\n\nTexto da mensagem: ${textoMensagem}`;
            } else {
                tituloEmail = `Nova mensagem (${tipo}) no chat ${chat.name || chat.id.user}`;
                corpoEmail = `Você recebeu uma ${tipo} de ${message.author || message.from} no chat ${chat.name || chat.id.user}.`;
            }

            console.log(`[DEBUG] Título do email: "${tituloEmail}"`);
            console.log(`[DEBUG] Enviando email para: ${emailDestino}`);

            await enviarEmail(
                emailDestino,
                tituloEmail,
                corpoEmail,
                attachment
            );
            console.log(`[DEBUG] Email enviado com sucesso!`);

            const isDefault = !this.emailPorUsuario.get(userId);
            const status = isDefault ? ' (email padrão)' : ' (email personalizado)';
            const mensagemConfirmacao = textoMensagem
                ? `✅ ${tipo} enviada para: ${emailDestino}${status}\n📧 Título: "${textoMensagem}"`
                : `✅ ${tipo} enviada para: ${emailDestino}${status}`;

            await chat.sendMessage(mensagemConfirmacao);
        } catch (e) {
            console.error(`[ERRO] Erro ao processar mídia:`, e);
            await chat.sendMessage(`Erro ao enviar email: ${e.message}`);
        }
    }

    async handleDocument(message, chat) {
        await chat.sendMessage(`[${chat.name || chat.id.user}] ${message.author || message.from}: Enviou um DOCUMENTO (${message._data.mimetype}).`);
    }

    async handleInstrucao(chat) {
        await chat.sendMessage('🤖 *Bot WhatsApp Ativo*\n\n📧 *Email padrão configurado:* samal@cs-consoft.com.br\n\n📋 *Como usar:*\n• Envie uma *imagem* ou *PDF* para receber por email\n• Adicione um *texto junto com a imagem* para usar como título do email\n• Digite *#CONFIG* para configurar email personalizado\n\n✅ Pronto para receber seus arquivos!');
    }
}

const botHandler = new BotHandler();

// Importa as classes necessárias do whatsapp-web.js e libs para QR Code
const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
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

// Configurações baseadas no ambiente (apenas Puppeteer, sem authDataPath)
const getConfig = () => {
    if (IS_DOCKER) {
        return {
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
                    '--no-default-browser-check'
                ],
                timeout: 60000
            }
        };
    } else {
        return {};
    }
};

const config = getConfig();

// Função removida - com NoAuth não precisamos limpar sessão

// Com NoAuth, não precisamos limpar sessão pois ela nunca é salva
console.log('🚫 Modo sem sessão ativado - sempre será necessário escanear QR code');

let ultimoQR = null; // Armazena o último QR gerado
let qrMostrado = false; // Controla se o QR já foi exibido
let qrGerado = false; // Nova variável para controlar se já foi gerado

// Nome exato do grupo que será monitorado
const NOME_GRUPO = "GRUPO_X"; // Altere para o nome real do seu grupo

// Função para criar o cliente com tratamento de erro
function createClient() {
    try {
        console.log('🔧 Configurações do cliente:', JSON.stringify(config, null, 2));

        const client = new Client({
            authStrategy: new NoAuth(),
            ...config
        });

        // Adicionar listeners para debug
        if (IS_DOCKER) {
            client.on('disconnected', (reason) => {
                console.log('🔌 Cliente desconectado:', reason);
            });

            client.on('auth_failure', (msg) => {
                console.log('❌ Falha na autenticação:', msg);
            });

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
        }

        return client;
    } catch (error) {
        console.error('❌ Erro ao criar cliente WhatsApp:', error.message);
        console.error('🔍 Stack completo:', error.stack);

        if (IS_DOCKER) {
            console.log('🐳 Tentando configuração alternativa para Docker...');

            // Configuração mais minimalista
            const fallbackClient = new Client({
                authStrategy: new NoAuth(),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--single-process'
                    ],
                    executablePath: '/usr/bin/chromium-browser',
                    timeout: 30000
                }
            });

            return fallbackClient;
        }

        throw error;
    }
}

// Cria o cliente do WhatsApp
console.log('🚀 Criando cliente WhatsApp...');
const client = createClient();
console.log('✅ Cliente WhatsApp criado com sucesso!');
console.log('⏳ Aguardando autenticação ou QR Code...');

// Tratamento de erros não capturados com categorização
process.on('unhandledRejection', (reason, promise) => {
    const errorMsg = reason?.message || reason;

    // Erros específicos que podemos ignorar com segurança
    const ignorePatterns = [
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

    // Erros críticos que requerem atenção
    const criticalPatterns = [
        'EBUSY',
        'ENOENT',
        'Permission denied',
        'Cannot read properties'
    ];

    const isCritical = criticalPatterns.some(pattern =>
        String(errorMsg).includes(pattern)
    );

    if (isCritical) {
        console.error('❌ ERRO CRÍTICO (Unhandled Rejection):', errorMsg);
        console.error('📍 Promise:', promise);
        console.error('🔍 Stack:', reason?.stack);
    } else {
        console.log('⚠️  Unhandled Rejection (não crítico):', errorMsg);
    }
});

process.on('uncaughtException', (error) => {
    const errorMsg = error?.message || error;

    // Erros específicos que podemos ignorar
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
    console.error('🔍 Stack:', error?.stack);

    // Em ambiente Docker, reiniciar pode ser mais seguro
    if (IS_DOCKER) {
        console.error('🐳 Executando em Docker - considerando reinicialização...');
        // Não finalizar imediatamente, permitir que o container seja reiniciado externamente
        setTimeout(() => {
            console.error('💀 Finalizando processo após erro crítico...');
            process.exit(1);
        }, 5000);
    } else {
        console.log('💻 Executando localmente - continuando execução...');
    }
});

// Evento disparado quando o QR Code deve ser exibido no terminal
client.on('qr', qr => {
    console.log("🔄 Novo QR Code recebido!");

    qrGerado = true;
    qrMostrado = true;
    ultimoQR = qr;

    // Gera o QR no terminal
    qrcode.generate(qr, { small: true });
    console.log("📱 QR Code gerado! Escaneie com o WhatsApp (Aparelhos conectados).");
    console.log("⏰ O QR Code expira em alguns minutos, se não funcionar, reinicie o bot.");
});



// Evento disparado quando o bot está pronto para uso
client.on('ready', async () => {
    console.log('✅ Bot do WhatsApp está pronto e funcionando!');
    console.log('📱 Conectado como:', client.info.wid.user);
    console.log('📞 Nome:', client.info.pushname);
    console.log('💬 Pronto para receber mensagens PRIVADAS!');
    console.log('📧 Email padrão configurado: samal@cs-consoft.com.br');
    console.log('');
    console.log('📋 Como usar:');
    console.log('   • Envie uma imagem ou PDF em conversa privada');
    console.log('   • Adicione texto junto com a imagem para usar como título');
    console.log('   • Digite #CONFIG para configurar email personalizado');
    console.log('');
    console.log('🔄 Aguardando mensagens...');
    
    // Testar se consegue receber eventos
    setTimeout(() => {
        console.log('⏰ Bot ativo há 10 segundos - teste enviando uma mensagem!');
    }, 10000);
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

        const userId = botHandler.getUserId(message);
        console.log(`👤 User ID: ${userId}`);

        // Verificar se é comando de configuração
        if (message.body.toUpperCase() === '#CONFIG') {
            console.log('⚙️ Comando #CONFIG detectado');
            await botHandler.startConfig(message, chat, userId);
            return;
        }

        // Se estiver em modo config
        if (botHandler.isConfigMode(userId)) {
            console.log('📧 Processando configuração...');
            await botHandler.handleConfig(message, chat, userId);
            return;
        }

        // Verificar se tem mídia
        if (message.hasMedia) {
            console.log('📎 Mensagem com mídia detectada!');
            console.log(`📋 Tipo de mídia: ${message.type}`);
            
            const media = await message.downloadMedia();
            console.log(`📊 Mídia baixada - Tipo: ${media.mimetype}, Tamanho: ${media.data.length} bytes`);
            
            if (media.mimetype.startsWith('image/') || media.mimetype === 'application/pdf') {
                console.log('✅ Tipo de arquivo aceito, processando...');
                await botHandler.handleMedia(message, chat, userId);
            } else {
                console.log(`❌ Tipo de arquivo não suportado: ${media.mimetype}`);
                await message.reply('❌ Apenas imagens (JPG, PNG) e PDFs são aceitos.');
            }
        } else {
            console.log('💬 Mensagem sem mídia (apenas texto)');
            
            // Responder com instruções se for apenas texto
            if (message.body.toLowerCase().includes('help') || 
                message.body.toLowerCase().includes('ajuda') || 
                message.body === '?') {
                await botHandler.handleInstrucao(chat);
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


// Adicionar mais listeners para debug
client.on('message_create', async message => {
    console.log('🆕 message_create disparado');
});

client.on('message_revoke_everyone', async (after, before) => {
    console.log('🗑️ Mensagem deletada para todos');
});

client.on('message_ack', (message, ack) => {
    console.log(`📬 ACK da mensagem: ${ack}`);
});

client.on('change_state', state => {
    console.log('🔄 Estado mudou para:', state);
});

client.on('disconnected', (reason) => {
    console.log('🔌 Cliente desconectado:', reason);
});

console.log('🔧 Inicializando cliente WhatsApp...');
console.log('💬 Modo APENAS conversas privadas ativado');
console.log('🚫 Mensagens de grupo serão ignoradas');
console.log('♻️ Sempre será necessário escanear um novo QR Code');

// Adicionar delay em ambiente Docker para estabilizar
if (IS_DOCKER) {
    console.log('🐳 Aguardando 3 segundos para estabilizar ambiente Docker...');
    setTimeout(() => {
        console.log('🚀 Iniciando cliente...');
        client.initialize();
    }, 3000);
} else {
    client.initialize();
}