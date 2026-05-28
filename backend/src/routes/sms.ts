import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { deviceAuth } from '../middleware/auth';
import { smsRateLimit } from '../middleware/rateLimiter';
import { extractOtp, classifyService } from '../services/otpParser';
import { io } from '../index';
import { logger } from '../services/logger';

const router = Router();
const prisma = new PrismaClient();

router.post('/', smsRateLimit, deviceAuth, async (req: Request, res: Response) => {
  // Aceita tanto JSON body quanto query string
  // Query string é mais segura para o MacroDroid (escapa caracteres especiais automaticamente)
  const sender  = req.body.sender  || req.query.sender  as string;
  const message = req.body.message || req.query.message as string;
  const device  = req.body.device  || req.query.device  as string || 'android-01';
  const receivedAt = req.body.receivedAt || req.query.receivedAt as string;

  if (!sender || !message) {
    return res.status(400).json({ error: 'sender e message são obrigatórios' });
  }

  const code = extractOtp(message);

  if (!code) {
    logger.debug(`SMS sem código OTP: "${message.substring(0, 50)}"`);
    return res.json({ received: true, code: null, ignored: true });
  }

  const service = classifyService(sender, message);
  const receivedAtDate = receivedAt ? new Date(receivedAt) : new Date();
  const expiresAt = new Date(receivedAtDate.getTime() + 10 * 60 * 1000);

  try {
    const smsCode = await prisma.smsCode.create({
      data: {
        id: uuidv4(),
        sender,
        service,
        rawMessage: message,
        code,
        device,
        receivedAt: receivedAtDate,
        expiresAt,
      },
    });

    logger.info(`Novo OTP: ${service} → ${code}`);

    io.emit('NEW_CODE', {
      id: smsCode.id,
      service: smsCode.service,
      code: smsCode.code,
      sender: smsCode.sender,
      device: smsCode.device,
      receivedAt: smsCode.receivedAt,
      expiresAt: smsCode.expiresAt,
    });

    return res.status(201).json({ received: true, code, service, expiresAt });
  } catch (err) {
    logger.error('Erro ao salvar SMS:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
