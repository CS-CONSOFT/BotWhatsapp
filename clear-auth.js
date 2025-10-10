// Script para limpar a autenticação do WhatsApp
// Execute este script se o QR Code não aparecer ou se houver problemas de autenticação

const fs = require('fs');
const path = require('path');

const authPath = path.join(__dirname, '.wwebjs_auth');

console.log('🧹 Limpando dados de autenticação...');

if (fs.existsSync(authPath)) {
    try {
        // Remove a pasta de autenticação recursivamente
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log('✅ Dados de autenticação removidos com sucesso!');
        console.log('🔄 Agora execute o bot novamente com: npm start');
        console.log('📱 Um novo QR Code será gerado para autenticação.');
    } catch (error) {
        console.error('❌ Erro ao remover dados de autenticação:', error.message);
        console.log('🔧 Tente remover manualmente a pasta .wwebjs_auth');
    }
} else {
    console.log('ℹ️  Nenhum dado de autenticação encontrado.');
    console.log('🔄 Execute o bot normalmente com: npm start');
}