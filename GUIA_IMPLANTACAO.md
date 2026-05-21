# 📟 SMS OTP Central — Guia Completo de Implantação

> Stack: Node.js + TypeScript + Express + PostgreSQL + Prisma + Socket.IO + Nginx + Docker

---

## Visão geral do que vamos criar

```
Android (Tasker)
    │  POST /sms
    ▼
API (Express + Socket.IO) ←── Dashboard Web
    │
    ▼
PostgreSQL
```

---

## PARTE 1 — VPS: Preparação do servidor

### 1.1 — Conectar e atualizar

```bash
ssh root@IP_DO_SEU_VPS

apt update && apt upgrade -y
apt install -y git curl nginx certbot python3-certbot-nginx
```

### 1.2 — Instalar Docker e Docker Compose

```bash
curl -fsSL https://get.docker.com | bash
systemctl enable docker
systemctl start docker

# Verificar
docker --version
docker compose version
```

### 1.3 — Criar usuário dedicado (boa prática)

```bash
adduser otpadmin
usermod -aG sudo otpadmin
usermod -aG docker otpadmin
su - otpadmin
```

---

## PARTE 2 — Clonar e configurar o projeto

### 2.1 — Enviar os arquivos para o VPS

No seu computador local, compacte a pasta do projeto e envie:

```bash
# No seu computador local:
scp -r sms-otp-system/ otpadmin@IP_DO_VPS:/home/otpadmin/
```

Ou use Git:
```bash
# No VPS:
cd ~
git clone https://github.com/SEU_USUARIO/sms-otp-system.git
cd sms-otp-system
```

### 2.2 — Criar o arquivo .env

```bash
cd ~/sms-otp-system
cp .env.example .env
```

Gerar o JWT_SECRET:
```bash
openssl rand -hex 32
# Copie o resultado e cole no .env
```

Editar o .env:
```bash
nano .env
```

Preencha:
```env
POSTGRES_PASSWORD=UmaSenhaForteAqui123!
JWT_SECRET=COLE_O_RESULTADO_DO_OPENSSL
DEVICE_API_TOKEN=token-android-secreto-2024
FRONTEND_URL=https://otp.suaempresa.com.br
```

Salvar: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## PARTE 3 — Configurar domínio e SSL

### 3.1 — Apontar DNS

No painel do seu domínio (Cloudflare, Registro.br, etc.):

```
Tipo: A
Nome: otp
Valor: IP_DO_SEU_VPS
TTL: Auto
```

### 3.2 — Configurar Nginx

```bash
sudo cp ~/sms-otp-system/nginx/vps-proxy.conf /etc/nginx/sites-available/otp-system

# Editar e substituir "otp.suaempresa.com.br" pelo seu domínio real
sudo nano /etc/nginx/sites-available/otp-system

# Habilitar o site
sudo ln -s /etc/nginx/sites-available/otp-system /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Aplicar (temporariamente só HTTP para o certbot funcionar)
sudo systemctl reload nginx
```

### 3.3 — Gerar certificado SSL gratuito

```bash
sudo certbot --nginx -d otp.suaempresa.com.br
# Siga as instruções, aceite os termos, informe seu email
```

---

## PARTE 4 — Subir os containers

### 4.1 — Build e start

```bash
cd ~/sms-otp-system
docker compose up -d --build

# Acompanhar logs
docker compose logs -f
```

### 4.2 — Rodar migrations e seed

```bash
# Aguardar o container da API subir (30 segundos)
sleep 30

# Rodar migrations
docker compose exec api npx prisma migrate deploy

# Criar usuário admin e registrar o Android
docker compose exec api npx ts-node src/seed.ts
```

Você verá:
```
✅ Usuário admin criado: admin@suaempresa.com.br
   Senha: TroqueEssaSenha@2024
   ⚠️  ALTERE A SENHA APÓS O PRIMEIRO LOGIN!
✅ Dispositivo android-01 registrado
🚀 Setup concluído!
```

### 4.3 — Verificar se está funcionando

```bash
# Testar API
curl https://otp.suaempresa.com.br/api/health
# Resposta esperada: {"status":"ok","ts":"..."}

# Testar login
curl -X POST https://otp.suaempresa.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@suaempresa.com.br","password":"TroqueEssaSenha@2024"}'
# Resposta esperada: {"token":"eyJ..."}
```

---

## PARTE 5 — Configurar o Android (Tasker)

### 5.1 — Instalar o Tasker

Baixe o Tasker na Play Store (app pago, ~R$18). Vale cada centavo.

### 5.2 — Criar o perfil de captura de SMS

**No Tasker, crie um novo Perfil:**

1. Toque em **+** → **Evento** → **Telefone** → **SMS Recebido**
2. Em "Remetente": deixe em branco (captura de todos)
3. Nomeie o perfil como "Captura OTP"

**Crie a Tarefa vinculada ao perfil:**

1. Nova tarefa → **HTTP Request**
2. Configure:
   - **Método**: POST
   - **URL**: `https://otp.suaempresa.com.br/api/sms`
   - **Headers**:
     ```
     Authorization: Bearer TOKEN_DO_ANDROID_DO_SEU_ENV
     Content-Type: application/json
     ```
   - **Body**:
     ```json
     {
       "sender": "%SMSRF",
       "message": "%SMSRB",
       "device": "android-01",
       "receivedAt": "%TIMES"
     }
     ```

> **%SMSRF** = remetente do SMS
> **%SMSRB** = corpo do SMS
> **%TIMES** = timestamp Unix (o backend converte automaticamente)

### 5.3 — Permissões necessárias no Android

Vá em **Configurações → Apps → Tasker → Permissões** e habilite:
- ✅ SMS (Enviar e visualizar mensagens SMS)
- ✅ Acesso a notificações (opcional, mas útil)

Em **Configurações → Bateria → Tasker**: desabilite otimização de bateria para que o app rode em background sempre.

### 5.4 — Testar o Tasker manualmente

Na tarefa HTTP que criou:
1. Toque em ▶️ para rodar manualmente
2. Substitua as variáveis por valores de teste
3. Verifique se o dashboard mostra o código

---

## PARTE 6 — Primeiro acesso ao dashboard

1. Abra `https://otp.suaempresa.com.br` no browser
2. Login: `admin@suaempresa.com.br` / `TroqueEssaSenha@2024`
3. **Troque a senha imediatamente** (use a API):

```bash
# Criar novo usuário operador para a equipe
curl -X POST https://otp.suaempresa.com.br/api/auth/users \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"email":"operador@empresa.com","password":"SenhaForte123!","role":"OPERATOR"}'
```

---

## PARTE 7 — Comandos úteis do dia a dia

### Ver logs em tempo real
```bash
docker compose logs -f api
```

### Reiniciar a API (após atualização de código)
```bash
docker compose restart api
```

### Atualizar o sistema
```bash
# No seu computador local, após mudanças no código:
scp -r sms-otp-system/ otpadmin@IP_DO_VPS:/home/otpadmin/

# No VPS:
cd ~/sms-otp-system
docker compose up -d --build api
```

### Backup do banco
```bash
docker compose exec postgres pg_dump -U otp_user sms_otp_db > backup_$(date +%Y%m%d).sql
```

### Ver códigos recentes via API
```bash
curl https://otp.suaempresa.com.br/api/codes \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Parar tudo
```bash
docker compose down
```

---

## PARTE 8 — Segurança pós-deploy

### 8.1 — Firewall (UFW)
```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP (redireciona para HTTPS)
ufw allow 443   # HTTPS
ufw enable
ufw status
```

### 8.2 — Renovação automática do SSL
O certbot já configura renovação automática. Verificar:
```bash
systemctl status certbot.timer
```

### 8.3 — Backup automático do banco
Adicione ao crontab do VPS:
```bash
crontab -e
```
```
# Backup diário às 03:00
0 3 * * * cd /home/otpadmin/sms-otp-system && docker compose exec -T postgres pg_dump -U otp_user sms_otp_db | gzip > ~/backups/otp_$(date +\%Y\%m\%d).sql.gz
```

---

## Estrutura final de arquivos

```
sms-otp-system/
├── backend/
│   ├── src/
│   │   ├── index.ts              ← Entry point, Socket.IO
│   │   ├── seed.ts               ← Criar admin + registrar Android
│   │   ├── routes/
│   │   │   ├── sms.ts            ← POST /sms (Tasker chama isso)
│   │   │   ├── auth.ts           ← Login, criar usuários/devices
│   │   │   └── codes.ts          ← Leitura do dashboard
│   │   ├── services/
│   │   │   ├── otpParser.ts      ← Extração de código via regex
│   │   │   └── logger.ts         ← Winston logs
│   │   └── middleware/
│   │       ├── auth.ts           ← JWT + device token
│   │       └── rateLimiter.ts    ← Rate limiting
│   ├── prisma/schema.prisma      ← Schema do banco
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   └── index.html                ← Dashboard completo (single file)
├── nginx/
│   ├── frontend.conf             ← Nginx para o container do frontend
│   └── vps-proxy.conf            ← Nginx do VPS (proxy + SSL)
├── docker-compose.yml
└── .env.example
```

---

## Problemas comuns

| Problema | Solução |
|----------|---------|
| Dashboard não conecta no WebSocket | Verifique se o bloco `location /socket.io/` está no nginx e faça `nginx -t && nginx -s reload` |
| Tasker não envia SMS | Verifique permissões, desabilite otimização de bateria, teste manualmente a tarefa HTTP |
| Código não aparece no dashboard | Verifique se o regex está capturando: teste com `curl -X POST /sms` manualmente |
| Container da API não sobe | `docker compose logs api` — provavelmente falta variável de ambiente no .env |
| Certificado SSL falhou | DNS ainda não propagou. Aguarde 5-30 min e tente novamente |
