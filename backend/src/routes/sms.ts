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

// ── POST /sms ─────────────────────────────────────────────────────────────────
// Chamado pelo Tasker no Android quando um SMS é recebido
// Body: { sender, message, device, receivedAt }
router.post('/', smsRateLimit, deviceAuth, async (req: Request, res: Response) => {
  const { sender, message, device, receivedAt } = req.body;

  // Validação básica
  if (!sender || !message) {
    return res.status(400).json({ error: 'sender e message são obrigatórios' });
  }

  // Extração do código OTP
  const code = extractOtp(message);

  // Se não encontrou código numérico, ignora silenciosamente
  // (evita poluir o banco com SMS comuns como promoções)
  if (!code) {
    logger.debug(`SMS sem código OTP detectado: "${message.substring(0, 50)}..."`);
    return res.json({ received: true, code: null, ignored: true });
  }

  const service = classifyService(sender, message);
  const receivedAtDate = receivedAt ? new Date(receivedAt) : new Date();
  const expiresAt = new Date(receivedAtDate.getTime() + 10 * 60 * 1000); // 10 minutos

  try {
    const smsCode = await prisma.smsCode.create({
      data: {
        id: uuidv4(),
        sender,
        service,
        rawMessage: message,
        code,
        device: device || 'android-01',
        receivedAt: receivedAtDate,
        expiresAt,
      },
    });

    logger.info(`Novo código OTP: ${service} → ${code} (expira ${expiresAt.toISOString()})`);

    // ── Emite evento WebSocket para o dashboard atualizar instantaneamente ──
    io.emit('NEW_CODE', {
      id: smsCode.id,
      service: smsCode.service,
      code: smsCode.code,
      sender: smsCode.sender,
      device: smsCode.device,
      receivedAt: smsCode.receivedAt,
      expiresAt: smsCode.expiresAt,
    });

    return res.status(201).json({
      received: true,
      code,
      service,
      expiresAt,
    });
  } catch (err) {
    logger.error('Erro ao salvar SMS:', err);
    return res.status(500).json({ error: 'Erro interno ao salvar código' });
  }
});

export default router;
