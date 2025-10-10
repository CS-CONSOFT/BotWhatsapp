// Função utilitária para envio de email (usando nodemailer)
const nodemailer = require('nodemailer');

let emailConfig = {
    to: '', // Email de destino
};


async function enviarEmail(destino, assunto, texto, attachment) {
    console.log(`[EMAIL] Iniciando envio de email para: ${destino}`);
    console.log(`[EMAIL] Assunto: ${assunto}`);
    
    try {
        // Configure o transporter conforme seu provedor de email
        let transporter = nodemailer.createTransport({
            host:'email-ssl.com.br',
            port:587,
            secure: false, // true para 465, false para outras portas
            auth: {
                user:'samal@cs-consoft.com.br',
                pass:'C$1234sa;',
            },
        });

        console.log(`[EMAIL] Configuração SMTP: ${'email-ssl.com.br'}:${587}`);

        let mailOptions = {
            from: 'Bot Whatsapp <samal@cs-consoft.com.br>',
            to: destino || 'samal@cs-consoft.com.br', // Se não especificar destinatário, usa o email padrão
            subject: assunto,
            text: texto,
        };
        
        if (attachment) {
            mailOptions.attachments = [attachment];
            console.log(`[EMAIL] Anexo adicionado: ${attachment.filename} (${attachment.contentType})`);
        }
        
        console.log(`[EMAIL] Enviando email...`);
        let info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Email enviado com sucesso! ID: ${info.messageId}`);
        return info;
        
    } catch (error) {
        console.error(`[EMAIL] Erro ao enviar email:`, error);
        throw error;
    }
}

module.exports = { emailConfig, enviarEmail };