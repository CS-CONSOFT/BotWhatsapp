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
const { Client, LocalAuth, RemoteAuth, NoAuth } = require('whatsapp-web.js');
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

// Detectar ambiente Render
function isRenderEnvironment() {
    return process.env.RENDER === 'true' || 
           process.env.NODE_ENV === 'production' || 
           process.env.PORT || 
           process.env.RENDER_SERVICE_ID;
}

// Limpar variáveis de ambiente problemáticas no Render
if (isRenderEnvironment()) {
    console.log('🌐 Limpando variáveis de ambiente problemáticas...');
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    delete process.env.CHROME_BIN;
    delete process.env.GOOGLE_CHROME_BIN;
    process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';
}

// Configurações baseadas no ambiente (apenas Puppeteer, sem authDataPath)
const getConfig = () => {
    const isRender = isRenderEnvironment();
    
    if (isRender) {
        console.log('🌐 Ambiente Render detectado - usando configuração para produção');
        return {
            puppeteer: {
                headless: true,
                // Não especificar executablePath - deixar Puppeteer escolher
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--no-first-run',
                    '--disable-default-apps',
                    '--disable-translate',
                    '--disable-sync',
                    '--hide-scrollbars',
                    '--mute-audio',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-ipc-flooding-protection'
                ],
                timeout: 60000,
                ignoreDefaultArgs: false
            }
        };
    } else if (IS_DOCKER) {
        console.log('🐳 Ambiente Docker detectado');
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
        console.log('💻 Ambiente local detectado');
        return {};
    }
};

const config = getConfig();

// Função para configurar autenticação persistente
function getAuthStrategy() {
    const isRender = isRenderEnvironment();
    
    // Verificar se existe sessão pré-configurada
    const preConfiguredSession = checkPreConfiguredSession();
    
    if (preConfiguredSession) {
        console.log('🔑 Usando sessão pré-configurada - ZERO QR Code necessário!');
        return preConfiguredSession;
    }
    
    if (isRender && process.env.MONGODB_URI) {
        // Render com MongoDB - Autenticação remota persistente
        console.log('🔐 Configurando autenticação REMOTA (MongoDB)');
        try {
            const { MongoStore } = require('wwebjs-mongo');
            const mongoose = require('mongoose');
            
            mongoose.connect(process.env.MONGODB_URI);
            const store = new MongoStore({ mongoose: mongoose });
            
            return new RemoteAuth({
                store: store,
                backupSyncIntervalMs: 300000,
                clientId: "whatsapp-bot-csconsoft"
            });
        } catch (error) {
            console.log('❌ Erro ao configurar MongoDB, usando LocalAuth como fallback');
            return getLocalAuth();
        }
    } else {
        // Local/Docker/Render sem MongoDB - Autenticação local persistente
        return getLocalAuth();
    }
}

// Verificar se existe sessão pré-configurada
function checkPreConfiguredSession() {
    try {
        // Verificar se existe arquivo de sessão pré-configurado
        const preSessionPath = './pre-configured-session';
        const authPath = './wwebjs_auth';
        
        if (fs.existsSync(preSessionPath)) {
            console.log('📁 Sessão pré-configurada encontrada!');
            
            // Copiar sessão pré-configurada para o local correto
            if (!fs.existsSync(authPath)) {
                fs.mkdirSync(authPath, { recursive: true });
            }
            
            // Copiar todos os arquivos da sessão
            const files = fs.readdirSync(preSessionPath);
            files.forEach(file => {
                const srcPath = path.join(preSessionPath, file);
                const destPath = path.join(authPath, file);
                
                if (fs.statSync(srcPath).isDirectory()) {
                    copyDirectory(srcPath, destPath);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
            });
            
            console.log('✅ Sessão pré-configurada copiada com sucesso!');
            return new LocalAuth({
                clientId: "whatsapp-bot-csconsoft",
                dataPath: authPath
            });
        }
        
        // Verificar variável de ambiente com sessão codificada
        if (process.env.WHATSAPP_SESSION_DATA) {
            console.log('🔑 Restaurando sessão de variável de ambiente...');
            return restoreSessionFromEnv();
        }
        
        return null;
    } catch (error) {
        console.log('❌ Erro ao verificar sessão pré-configurada:', error.message);
        return null;
    }
}

// Função para copiar diretório recursivamente
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    files.forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

// Restaurar sessão de variável de ambiente
function restoreSessionFromEnv() {
    try {
        const sessionData = JSON.parse(Buffer.from(process.env.WHATSAPP_SESSION_DATA, 'base64').toString());
        const authPath = './wwebjs_auth';
        
        if (!fs.existsSync(authPath)) {
            fs.mkdirSync(authPath, { recursive: true });
        }
        
        // Escrever dados da sessão
        Object.keys(sessionData).forEach(fileName => {
            const filePath = path.join(authPath, fileName);
            const dirPath = path.dirname(filePath);
            
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            
            fs.writeFileSync(filePath, sessionData[fileName]);
        });
        
        console.log('✅ Sessão restaurada de variável de ambiente!');
        return new LocalAuth({
            clientId: "whatsapp-bot-csconsoft",
            dataPath: authPath
        });
    } catch (error) {
        console.log('❌ Erro ao restaurar sessão de variável de ambiente:', error.message);
        return null;
    }
}

function getLocalAuth() {
    console.log('🔐 Configurando autenticação LOCAL (persistente)');
    
    // Usar número de telefone como identificador da sessão
    const phoneNumber = process.env.WHATSAPP_PHONE || process.env.PHONE_NUMBER || "default";
    const sessionName = `whatsapp-bot-${phoneNumber}`;
    const authPath = `./sessions/${sessionName}`;
    
    // Garantir que o diretório existe
    if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
        console.log(`📁 Criado diretório de autenticação: ${authPath}`);
    }
    
    console.log(`📱 Sessão configurada para: ${phoneNumber}`);
    
    return new LocalAuth({
        clientId: sessionName,
        dataPath: authPath
    });
}

// Configurar estratégia de autenticação
const authStrategy = getAuthStrategy();

// Autenticação persistente configurada - QR Code apenas na primeira vez
console.log('✅ Modo de autenticação PERSISTENTE ativado');
console.log('📱 QR Code necessário APENAS na primeira execução');
console.log('🔄 Execuções seguintes conectarão automaticamente');

let ultimoQR = null; // Armazena o último QR gerado
let qrMostrado = false; // Controla se o QR já foi exibido
let qrGerado = false; // Nova variável para controlar se já foi gerado
let sessaoExiste = false; // Verifica se já existe sessão salva

// Verificar se já existe sessão salva
function verificarSessaoExistente() {
    try {
        const authPath = './wwebjs_auth';
        if (fs.existsSync(authPath)) {
            const files = fs.readdirSync(authPath);
            sessaoExiste = files.length > 0;
            
            if (sessaoExiste) {
                console.log('✅ Sessão existente encontrada - conectando automaticamente...');
                console.log('🚫 QR Code NÃO será necessário!');
            } else {
                console.log('⚠️  Primeira execução - QR Code será necessário UMA vez');
            }
        }
    } catch (error) {
        console.log('🔍 Verificando sessão pela primeira vez...');
        sessaoExiste = false;
    }
    
    return sessaoExiste;
}

// Verificar sessão existente
verificarSessaoExistente();

// Função para exportar dados da sessão
function exportSessionData() {
    try {
        const authPath = './wwebjs_auth';
        if (!fs.existsSync(authPath)) {
            console.log('❌ Nenhuma sessão encontrada para exportar');
            return;
        }
        
        const sessionData = {};
        
        function readDirectory(dirPath, basePath = '') {
            const files = fs.readdirSync(dirPath);
            
            files.forEach(file => {
                const fullPath = path.join(dirPath, file);
                const relativePath = basePath ? path.join(basePath, file) : file;
                
                if (fs.statSync(fullPath).isDirectory()) {
                    readDirectory(fullPath, relativePath);
                } else {
                    sessionData[relativePath] = fs.readFileSync(fullPath);
                }
            });
        }
        
        readDirectory(authPath);
        
        // Converter para base64 para facilitar transporte
        const sessionBase64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        
        // Salvar em arquivo
        fs.writeFileSync('./session-export.txt', sessionBase64);
        
        console.log('✅ Sessão exportada para: ./session-export.txt');
        console.log('🔑 Use este arquivo para configurar WHATSAPP_SESSION_DATA');
        console.log('📋 Conteúdo do arquivo pode ser usado como variável de ambiente');
        
    } catch (error) {
        console.log('❌ Erro ao exportar sessão:', error.message);
    }
}

// Nome exato do grupo que será monitorado
const NOME_GRUPO = "GRUPO_X"; // Altere para o nome real do seu grupo

// Função para criar o cliente com tratamento de erro
function createClient() {
    try {
        console.log('🔧 Configurações do cliente:', JSON.stringify(config, null, 2));
        
        // Log para debug no Render
        if (isRenderEnvironment()) {
            console.log('🐞 Debug Render:');
            console.log(`   - PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'undefined'}`);
            console.log(`   - PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: ${process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD}`);
            console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
            console.log(`   - RENDER: ${process.env.RENDER}`);
        }

        const client = new Client({
            authStrategy: authStrategy,
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
                authStrategy: authStrategy,
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

// Criar servidor HTTP para health check (para Render)
const http = require('http');
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
    if (sessaoExiste) {
        console.log("⚠️ QR Code solicitado mesmo com sessão existente - pode haver problema na sessão");
        console.log("�️ Limpando sessão corrompida...");
        
        // Limpar sessão corrompida
        try {
            const authPath = './wwebjs_auth';
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
                console.log("✅ Sessão corrompida removida");
            }
        } catch (error) {
            console.log("❌ Erro ao limpar sessão:", error.message);
        }
    }

    console.log("📱 PRIMEIRA EXECUÇÃO - QR Code necessário para configuração inicial");
    console.log("🔄 Após escanear, o bot lembrará da sessão PERMANENTEMENTE");

    qrGerado = true;
    qrMostrado = true;
    ultimoQR = qr;

    // Gera o QR no terminal
    qrcode.generate(qr, { small: true });
    console.log("📱 QR Code gerado! Escaneie com o WhatsApp (Aparelhos conectados).");
    console.log("🎯 IMPORTANTE: Após escanear, QR Code NUNCA mais será necessário!");
    console.log("⏰ O QR Code expira em alguns minutos, se não funcionar, reinicie o bot.");
});

// Evento disparado quando a autenticação é bem-sucedida
client.on('authenticated', () => {
    console.log('🔐 Autenticação realizada com sucesso!');
    console.log('💾 Sessão será salva para próximas execuções');
    console.log('🚫 QR Code não será mais necessário!');
});

// Evento disparado em caso de falha na autenticação
client.on('auth_failure', msg => {
    console.log('❌ Falha na autenticação:', msg);
    console.log('🗑️ Limpando possível sessão corrompida...');
    
    try {
        const authPath = './wwebjs_auth';
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log("✅ Sessão corrompida removida - reinicie o bot");
        }
    } catch (error) {
        console.log("❌ Erro ao limpar sessão:", error.message);
    }
});



// Evento disparado quando o bot está pronto para uso
client.on('ready', async () => {
    console.log('✅ Bot do WhatsApp está pronto e funcionando!');
    console.log('📱 Conectado como:', client.info.wid.user);
    console.log('📞 Nome:', client.info.pushname);
    console.log('� SESSÃO SALVA - Próximas execuções conectarão automaticamente!');
    console.log('🚫 QR Code NUNCA mais será necessário (até logout manual)');
    console.log('�💬 Pronto para receber mensagens PRIVADAS!');
    console.log('📧 Email padrão configurado: samal@cs-consoft.com.br');
    console.log('');
    console.log('📋 Como usar:');
    console.log('   • Envie uma imagem ou PDF em conversa privada');
    console.log('   • Adicione texto junto com a imagem para usar como título');
    console.log('   • Digite #CONFIG para configurar email personalizado');
    console.log('');
    console.log('🔄 Aguardando mensagens...');
    
    // Marcar que a sessão foi estabelecida com sucesso
    sessaoExiste = true;
    
    // Exportar sessão para backup (se solicitado)
    if (process.env.EXPORT_SESSION === 'true') {
        setTimeout(() => {
            exportSessionData();
        }, 5000);
    }
    
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
console.log('💾 Autenticação PERSISTENTE - QR Code apenas na primeira vez');

if (sessaoExiste) {
    console.log('🚀 Conectando automaticamente com sessão salva...');
} else {
    console.log('⚠️ Primeira execução - QR Code será solicitado UMA vez');
}

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