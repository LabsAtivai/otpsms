import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { userAuth } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// ── GET /codes — lista códigos ativos (não expirados) ────────────────────────
router.get('/', userAuth, async (req: Request, res: Response) => {
  const { service, device, limit = '50' } = req.query;

  const where: any = {
    expiresAt: { gt: new Date() }, // somente não expirados
  };

  if (service) where.service = { contains: String(service), mode: 'insensitive' };
  if (device) where.device = String(device);

  try {
    const codes = await prisma.smsCode.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: parseInt(String(limit)),
      select: {
        id: true,
        service: true,
        code: true,
        sender: true,
        device: true,
        receivedAt: true,
        expiresAt: true,
        // rawMessage omitido por segurança — apenas admins veem abaixo
      },
    });

    return res.json(codes);
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// ── GET /codes/:service/latest — último código de um serviço ─────────────────
router.get('/:service/latest', userAuth, async (req: Request, res: Response) => {
  const { service } = req.params;

  try {
    const code = await prisma.smsCode.findFirst({
      where: {
        service: { contains: service, mode: 'insensitive' },
        expiresAt: { gt: new Date() },
      },
      orderBy: { receivedAt: 'desc' },
      select: {
        id: true,
        service: true,
        code: true,
        receivedAt: true,
        expiresAt: true,
      },
    });

    if (!code) {
      return res.status(404).json({ error: 'Nenhum código ativo para este serviço' });
    }

    return res.json(code);
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// ── GET /codes/history — histórico (inclui expirados, só ADMIN) ──────────────
router.get('/history', userAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.role === 'READER') {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  const { from, to, service, limit = '100' } = req.query;

  const where: any = {};
  if (service) where.service = { contains: String(service), mode: 'insensitive' };
  if (from || to) {
    where.receivedAt = {};
    if (from) where.receivedAt.gte = new Date(String(from));
    if (to) where.receivedAt.lte = new Date(String(to));
  }

  try {
    const codes = await prisma.smsCode.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: parseInt(String(limit)),
    });

    return res.json(codes);
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
