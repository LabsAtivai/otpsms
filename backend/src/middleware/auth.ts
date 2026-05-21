import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Middleware: autenticação de dispositivo Android (Bearer token fixo) ──
export async function deviceAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token ausente' });
  }

  const token = authHeader.substring(7);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const device = await prisma.device.findFirst({
      where: { tokenHash, active: true },
    });

    if (!device) {
      return res.status(401).json({ error: 'Dispositivo não autorizado' });
    }

    // Atualiza lastSeen
    await prisma.device.update({
      where: { id: device.id },
      data: { lastSeen: new Date() },
    });

    (req as any).device = device;
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}

// ── Middleware: autenticação de usuário via JWT ──────────────────────────────
export function userAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token ausente' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    (req as any).user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ── Middleware: verificação de role ──────────────────────────────────────────
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    return next();
  };
}
