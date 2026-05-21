# OTP SMS Central — Ativa.ai

Sistema interno para centralizar códigos de autenticação SMS (OTP) recebidos no chip corporativo.

## Stack

- **Backend**: Node.js + TypeScript + Express + Prisma + Socket.IO
- **Banco**: PostgreSQL
- **Frontend**: HTML/JS vanilla (dashboard com WebSocket)
- **Infra**: Docker + Portainer + Nginx Proxy Manager

## Deploy via Portainer

Ver `GUIA_IMPLANTACAO.md` para o passo a passo completo.

## Estrutura

```
├── backend/          Node.js API
├── frontend/         Dashboard web
├── nginx/            Config do container frontend
├── docker-compose.yml
└── .env.example      Variáveis necessárias
```
