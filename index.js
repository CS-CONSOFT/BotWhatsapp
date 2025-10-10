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

// Importa as classes necessárias do whatsapp-web.js e libs para QR Code e servidor web
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const { log } = require('console');
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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
            authDataPath: '/app/.wwebjs_auth',
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
            authDataPath: path.join(__dirname, '.wwebjs_auth'),
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

// Função para limpar sessão automaticamente
function limparSessaoAutomaticamente() {
    console.log('🧹 Limpando sessão anterior automaticamente...');
    
    if (fs.existsSync(config.authDataPath)) {
        try {
            // No Windows, usa o comando del/rmdir para ser mais eficiente
            const { execSync } = require('child_process');
            const isWindows = process.platform === 'win32';
            
            if (isWindows) {
                // Usa comando do Windows para remover forçadamente
                try {
                    execSync(`rmdir /s /q "${config.authDataPath}"`, { stdio: 'ignore' });
                    console.log('✅ Sessão anterior removida com sucesso (método Windows)!');
                    return;
                } catch (cmdError) {
                    console.log('⚠️  Comando Windows falhou, tentando método Node.js...');
                }
            }
            
            // Fallback para método Node.js
            fs.rmSync(config.authDataPath, { recursive: true, force: true });
            console.log('✅ Sessão anterior removida com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao remover sessão anterior:', error.message);
            console.log('🔧 Tentando método alternativo...');
            
            // Método alternativo: renomear a pasta para forçar nova sessão
            try {
                const backupPath = config.authDataPath + '_backup_' + Date.now();
                fs.renameSync(config.authDataPath, backupPath);
                console.log('✅ Sessão anterior movida para backup!');
                console.log('📝 Pasta de backup criada:', path.basename(backupPath));
            } catch (renameError) {
                console.error('❌ Método alternativo também falhou:', renameError.message);
                console.log('⚠️  Continuando mesmo assim... Forçando novo QR Code.');
            }
        }
    } else {
        console.log('ℹ️  Nenhuma sessão anterior encontrada.');
    }
}

// Limpa a sessão automaticamente sempre que o bot iniciar
limparSessaoAutomaticamente();

let ultimoQR = null; // Armazena o último QR gerado
let qrMostrado = false; // Controla se o QR já foi exibido
let qrGerado = false; // Nova variável para controlar se já foi gerado

// Nome exato do grupo que será monitorado
const NOME_GRUPO = "GRUPO_X"; // Altere para o nome real do seu grupo

// Função para criar o cliente com tratamento de erro
function createClient() {
    try {
        // Força sempre uma nova sessão usando um ID único
        const sessionId = 'session_' + Date.now();
        const client = new Client({
            authStrategy: new LocalAuth({
                dataPath: config.authDataPath,
                clientId: sessionId
            }),
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

// Evento disparado quando o QR Code deve ser exibido no terminal e salvo para web
client.on('qr', qr => {
    console.log("🔄 Novo QR Code recebido!");
    
    qrGerado = true;
    qrMostrado = true;
    ultimoQR = qr;
    
    // Gera o QR no terminal
    qrcode.generate(qr, {small: true});
    console.log("📱 QR Code gerado! Escaneie com o WhatsApp (Aparelhos conectados).");
    console.log("🌐 Acesse o QR Code via web em: http://localhost:3000/qr");
    console.log("⏰ O QR Code expira em alguns minutos, se não funcionar, reinicie o bot.");
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

// Inicia o servidor web 
const bindAddress = IS_DOCKER ? '0.0.0.0' : 'localhost';
app.listen(PORT, bindAddress, () => {
    const ifaces = os.networkInterfaces();
    let urls = [];
    
    // Para ambiente local, mostrar apenas localhost
    if (!IS_DOCKER) {
        urls.push(`http://localhost:${PORT}/qr`);
    } else {
        // Para Docker, mostrar todos os IPs disponíveis
        Object.values(ifaces).forEach(ifaceList => {
            ifaceList.forEach(iface => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    urls.push(`http://${iface.address}:${PORT}/qr`);
                }
            });
        });
        if (urls.length === 0) {
            urls.push(`http://0.0.0.0:${PORT}/qr`);
        }
    }
    
    console.log(`Servidor web do QR Code rodando em (${IS_DOCKER ? 'Docker' : 'Local'}):`);
    urls.forEach(url => console.log(url));
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
console.log('📱 Se você já tem uma sessão salva, o bot conectará automaticamente.');
console.log('🔑 Se não, um QR Code será gerado para autenticação.');
client.initialize();