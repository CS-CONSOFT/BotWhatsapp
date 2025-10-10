# Correções para Problemas EBUSY no Bot WhatsApp

Este documento descreve as correções implementadas para resolver os erros `EBUSY: resource busy or locked` e outros problemas relacionados ao deployment do bot WhatsApp em Docker.

## 🐛 Problemas Identificados

1. **EBUSY Error**: Múltiplos containers tentando usar o mesmo volume
2. **Protocol Error**: Erros de sessão do Puppeteer/Chromium
3. **Conflitos de Volume**: Volume sendo usado por container anterior
4. **Permissões Incorretas**: Problemas de acesso ao diretório de sessão
5. **Shutdown Inadequado**: Containers não sendo parados corretamente

## 🔧 Correções Implementadas

### 1. Dockerfile Melhorado (`Dockerfile`)

**Principais mudanças:**
- Adicionado `tini` como init process para gerenciar sinais corretamente
- Instalação de ferramentas de sistema (`procps`, `lsof`)
- Uso de volume declarado para persistência de dados
- Script de inicialização personalizado (`docker-start.sh`)
- Permissões de arquivos otimizadas

**Benefícios:**
- Melhor gerenciamento de processos zumbis
- Shutdown gracioso de containers
- Tratamento adequado de sinais do sistema

### 2. Script de Inicialização Docker (`docker-start.sh`)

**Funcionalidades:**
- Limpeza automática de sessões antigas
- Detecção e finalização de processos pendentes
- Verificação de permissões de diretório
- Tratamento robusto de erros EBUSY
- Shutdown gracioso com tratamento de sinais

**Como funciona:**
1. Verifica e limpa arquivos de sessão anteriores
2. Finaliza processos que possam estar usando o diretório
3. Usa métodos alternativos se a remoção direta falhar
4. Testa permissões antes de iniciar a aplicação
5. Gerencia shutdown gracioso da aplicação

### 3. Workflow de Deploy Corrigido (`deployment-workflow-corrigido.yml`)

**Melhorias no deployment:**
- Parada gracioso de containers (30s timeout)
- Verificação de parada completa antes de remover
- Limpeza de volumes órfãos
- Tratamento robusto de processos na porta 3005
- Método alternativo para remoção de diretórios
- Verificação de status após deploy
- Logs detalhados para debugging

**Novas configurações do container:**
- `--restart unless-stopped`: Reinicialização automática
- `--shm-size=2g`: Maior espaço de memória compartilhada
- Timezone configurado para América/São Paulo
- Variáveis de ambiente otimizadas

### 4. Script de Limpeza Docker (`docker-cleanup.sh`)

**Funcionalidades completas:**
- Parada gracioso de containers relacionados ao bot
- Limpeza de processos usando porta 3005
- Remoção de diretórios de sessão com múltiplos métodos
- Limpeza de volumes Docker órfãos
- Remoção de imagens antigas (mantém 3 mais recentes)
- Verificação final do sistema

**Quando usar:**
- Antes de fazer novo deploy
- Quando houver erros EBUSY persistentes
- Para limpeza completa do ambiente

### 5. Tratamento de Erros Melhorado (`index.js`)

**Categorização de erros:**
- **Ignoráveis**: Erros de protocolo do Puppeteer
- **Críticos**: EBUSY, ENOENT, permissões
- **Informativos**: Mudanças de estado, bateria

**Melhorias:**
- Logging mais detalhado com emojis para facilitar identificação
- Tratamento específico para diferentes tipos de desconexão
- Recuperação automática para erros não críticos
- Melhor gestão do estado do QR Code

## 📝 Como Usar as Correções

### 1. Aplicar as Correções no Projeto

```bash
# 1. Substituir o Dockerfile atual pelo corrigido
# 2. Adicionar o docker-start.sh ao projeto
# 3. Tornar o script executável
chmod +x docker-start.sh

# 4. Adicionar o script de limpeza
chmod +x docker-cleanup.sh

# 5. Atualizar o index.js com as melhorias de tratamento de erro
```

### 2. Usar o Script de Limpeza

```bash
# No servidor, executar antes do deploy:
sudo ./docker-cleanup.sh

# Ou integrar no workflow de deploy (já incluído no YAML corrigido)
```

### 3. Atualizar o Workflow de Deploy

```bash
# Substituir o workflow atual pelo deployment-workflow-corrigido.yml
# Renomear para o nome original do seu workflow
```

### 4. Verificar Deploy

```bash
# Após o deploy, verificar logs:
sudo docker logs -f bot_whatsapp_ctn_005

# Verificar status do container:
sudo docker ps --filter "name=bot_whatsapp"

# Testar QR Code:
curl -I http://IP_DO_SERVIDOR:3005/qr
```

## 🚀 Comandos Úteis para Troubleshooting

### Verificar Estado Atual
```bash
# Ver containers em execução
sudo docker ps -a --filter "name=bot_whatsapp"

# Ver logs detalhados
sudo docker logs --tail=50 bot_whatsapp_ctn_005

# Ver processos na porta 3005
sudo lsof -i :3005

# Ver volumes
sudo docker volume ls | grep -E "(wwebjs|whatsapp|bot)"
```

### Limpeza Manual de Emergência
```bash
# Parar todos os containers do bot
sudo docker stop $(sudo docker ps -q --filter "name=bot_whatsapp")
sudo docker rm -f $(sudo docker ps -aq --filter "name=bot_whatsapp")

# Limpar porta 3005
sudo kill -9 $(sudo lsof -t -i :3005) 2>/dev/null || true

# Limpar diretório de sessão
sudo fuser -k ./.wwebjs_auth 2>/dev/null || true
sudo rm -rf ./.wwebjs_auth

# Limpar volumes órfãos
sudo docker volume prune -f
```

### Monitoramento Contínuo
```bash
# Monitorar logs em tempo real
sudo docker logs -f bot_whatsapp_ctn_005

# Monitorar recursos do container
sudo docker stats bot_whatsapp_ctn_005

# Verificar health do container
sudo docker inspect bot_whatsapp_ctn_005 | grep -A 10 '"State"'
```

## ⚠️ Importantes Considerações

### Permissões
- O usuário `node` (UID 1000) é usado dentro do container
- Diretório `.wwebjs_auth` deve ter permissões 755
- Volume deve ser montado com propriedade correta

### Recursos
- Container configurado com `--shm-size=2g` para Chromium
- Timeout de 30s para shutdown gracioso
- Reinicialização automática habilitada

### Logs
- Logs detalhados com timestamps
- Emojis para facilitar identificação visual
- Diferentes níveis de logging para debug

### Segurança
- Container roda como usuário não-root
- Configurações de segurança do Chromium aplicadas
- Capabilities mínimas necessárias

## 🔄 Processo de Deploy Recomendado

1. **Antes do Deploy**: Executar script de limpeza
2. **Build**: Construir nova imagem com correções
3. **Deploy**: Usar workflow corrigido
4. **Verificação**: Confirmar funcionamento via logs e QR Code
5. **Monitoramento**: Acompanhar logs por alguns minutos

## 📞 Suporte

Se ainda houver problemas após aplicar estas correções:

1. Verificar logs detalhados do container
2. Confirmar que todas as correções foram aplicadas
3. Executar limpeza completa com o script fornecido
4. Verificar recursos disponíveis no servidor
5. Considerar reinicialização do servidor se necessário

---

**Nota**: Estas correções foram projetadas para resolver especificamente os problemas EBUSY e melhorar a estabilidade geral do bot WhatsApp em ambiente Docker.