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
        return typeof state === 'object' && state.modoConfig;
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
            puppeteerConfig: {
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
        };
    } else {
        // Configuração para Windows/Local
        const isWindows = process.platform === 'win32';
        return {
            puppeteerConfig: {
                headless: 'new', // Usa o novo modo headless
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-features=TranslateUI',
                    '--disable-ipc-flooding-protection',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    ...(isWindows ? ['--disable-gpu', '--disable-software-rasterizer'] : [])
                ]
            }
        };
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
        // Usa NoAuth para sempre forçar novo QR Code - sem salvar sessão
        const client = new Client({
            authStrategy: new NoAuth(),
            puppeteer: config.puppeteerConfig
        });

        // Tratamento abrangente de erros do cliente
        client.on('auth_failure', msg => {
            console.error('❌ Falha na autenticação:', msg);
            console.log('🔧 Possíveis soluções:');
            console.log('   1. Apague a pasta .wwebjs_auth e escaneie um novo QR Code');
            console.log('   2. Verifique se o WhatsApp Web está funcionando no navegador');
            console.log('   3. Tente usar um telefone diferente para escanear');
            
            // Limpar estado para permitir nova tentativa
            qrGerado = false;
            qrMostrado = false;
            ultimoQR = null;
        });

        client.on('disconnected', (reason) => {
            console.log('❌ Cliente desconectado:', reason);
            console.log('🔄 Resetando estado do QR Code...');
            qrGerado = false;
            qrMostrado = false;
            ultimoQR = null;
            
            // Diferentes ações baseadas no motivo da desconexão
            if (reason === 'LOGOUT') {
                console.log('👋 Logout detectado - usuário deslogou do WhatsApp');
            } else if (reason === 'NAVIGATION') {
                console.log('🧭 Desconexão por navegação - tentativa de reconexão automática');
            } else if (reason === 'CONFLICT') {
                console.log('⚔️  Conflito detectado - WhatsApp Web aberto em outro local');
            } else {
                console.log('🔍 Motivo da desconexão:', reason);
            }
            
            console.log('⚠️  Bot desconectado! Reinicie o bot para gerar um novo QR Code.');
        });

        client.on('change_state', state => {
            console.log('🔄 Estado do cliente alterado:', state);
        });

        client.on('change_battery', (batteryInfo) => {
            console.log('🔋 Informações da bateria:', batteryInfo);
        });

        // Tratamento de erros gerais do cliente
        client.on('error', (error) => {
            console.error('❌ Erro no cliente WhatsApp:', error.message);
            
            // Categorizar erros para melhor tratamento
            if (error.message.includes('Protocol error')) {
                console.log('🔇 Erro de protocolo - geralmente pode ser ignorado');
            } else if (error.message.includes('Session closed')) {
                console.log('📱 Sessão fechada - necessário novo QR Code');
                qrGerado = false;
                qrMostrado = false;
                ultimoQR = null;
            } else if (error.message.includes('EBUSY')) {
                console.log('🔒 Recurso ocupado - tentando recuperação automática...');
            } else {
                console.error('🔍 Stack trace:', error.stack);
            }
        });

        return client;
    } catch (error) {
        console.error('Erro ao criar cliente:', error);
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
    qrcode.generate(qr, {small: true});
    console.log("📱 QR Code gerado! Escaneie com o WhatsApp (Aparelhos conectados).");
    console.log("⏰ O QR Code expira em alguns minutos, se não funcionar, reinicie o bot.");
});



// Evento disparado quando o bot está pronto para uso
client.on('ready', async () => {
    qrMostrado = false;
    qrGerado = false; // Reset para permitir novo QR se deslogar
    ultimoQR = null; // Limpa o QR quando conectado
    
    console.log('🚀 Bot está online e pronto para receber mensagens!');
    console.log('📧 Email padrão configurado: samal@cs-consoft.com.br');
    console.log('🔧 Para configurar email personalizado, envie: #CONFIG');
    
    try {
        const clientInfo = client.info;
        console.log(`📱 Conectado como: ${clientInfo.pushname} (${clientInfo.wid.user})`);
    } catch (error) {
        console.log('⚠️  Não foi possível obter informações do cliente, mas bot está funcional');
    }
});

// Evento disparado para cada mensagem recebida
client.on('message', async message => {
    try {
        const chat = await message.getChat();
        console.log(`[DEBUG] Mensagem recebida - Tipo: ${chat.isGroup ? 'GRUPO' : 'PRIVADO'}`);
        console.log(`[DEBUG] De: ${message.from}`);
        console.log(`[DEBUG] Conteúdo: ${message.body}`);
        console.log(`[DEBUG] Tipo da mensagem: ${message.type}`);
        
        if (chat.isGroup) {
            console.log(`[DEBUG] Nome do grupo: ${chat.name}`);
            // Se NOME_GRUPO estiver configurado como "GRUPO_X", isso significa que você deve alterar
            // para o nome real do seu grupo. Por enquanto, vou permitir processar TODOS os grupos
            // ou configurar para processar apenas o grupo específico
            if (NOME_GRUPO !== "GRUPO_X" && chat.name !== NOME_GRUPO) {
                console.log(`[DEBUG] Ignorando grupo "${chat.name}" - apenas processando "${NOME_GRUPO}"`);
                return;
            }
            console.log(`[DEBUG] Processando mensagem do grupo: ${chat.name}`);
        }
        
        console.log(`[DEBUG] Processando mensagem privada...`);
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
    
    } catch (error) {
        console.error(`[ERRO] Erro ao processar mensagem de ${message.from}:`, error);
        console.error(`[ERRO] Stack trace:`, error.stack);
        
        try {
            const chat = await message.getChat();
            await chat.sendMessage('❌ Ocorreu um erro interno. Tente novamente em alguns segundos.');
        } catch (chatError) {
            console.error(`[ERRO] Não foi possível enviar mensagem de erro:`, chatError);
        }
    }
});

console.log('🔧 Inicializando cliente WhatsApp...');
console.log('� Modo sem sessão: SEMPRE será necessário escanear um novo QR Code.');
console.log('♻️  Isso garante que o bot conecte do zero a cada reinicialização.');
client.initialize();