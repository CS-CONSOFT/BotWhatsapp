// Função utilitária para envio de email (usando nodemailer)
const nodemailer = require('nodemailer');

let emailConfig = {
    to: '', // Email de destino
};


async function enviarEmail(destino, assunto, texto, attachment) {
    // Configure o transporter conforme seu provedor de email
    let transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true para 465, false para outras portas
        auth: {
            user: process.env.SMTP_USER || 'ggestaosalafacomp@gmail.com',
            pass: process.env.SMTP_PASS || 'mggo atxt fqfj ecxx',
        },
    });

    let mailOptions = {
        from: 'Bot Whatsapp <bot@example.com>',
        to: destino,
        subject: assunto,
        text: texto,
    };
    if (attachment) {
        mailOptions.attachments = [attachment];
    }
    let info = await transporter.sendMail(mailOptions);
    return info;
}

module.exports = { emailConfig, enviarEmail };