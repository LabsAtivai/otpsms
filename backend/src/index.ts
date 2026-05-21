import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

import smsRoutes from './routes/sms';
import authRoutes from './routes/auth';
import codesRoutes from './routes/codes';
import { logger } from './services/logger';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

// Socket.IO — broadcast para todos os clientes autenticados
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ── Middlewares globais ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ── Rotas ────────────────────────────────────────────────────────────
app.use('/sms', smsRoutes);        // recebe POST do Android
app.use('/auth', authRoutes);      // login/logout
app.use('/codes', codesRoutes);    // leitura do dashboard

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Cron: limpar códigos expirados a cada 5 min ──────────────────────
cron.schedule('*/5 * * * *', async () => {
  const deleted = await prisma.smsCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (deleted.count > 0) {
    logger.info(`Cron: ${deleted.count} código(s) expirado(s) removido(s)`);
  }
});

// ── WebSocket auth (opcional — para MVP pode deixar aberto) ──────────
io.use((socket, next) => {
  // Aqui você pode validar JWT do socket se quiser restringir
  next();
});

// ── Start ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  logger.info(`API rodando na porta ${PORT}`);
});
