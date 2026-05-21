import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { loginRateLimit } from '../middleware/rateLimiter';
import { userAuth, requireRole } from '../middleware/auth';
import { logger } from '../services/logger';

const router = Router();
const prisma = new PrismaClient();

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', loginRateLimit, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Log tentativa falha
      logger.warn(`Login falhou para: ${email} (IP: ${req.ip})`);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' }
    );

    // Registrar acesso no log de auditoria
    await prisma.accessLog.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        action: 'LOGIN',
        ip: req.ip || 'unknown',
      },
    });

    logger.info(`Login bem-sucedido: ${email}`);

    return res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    logger.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// ── POST /auth/users — criar usuário (só ADMIN) ───────────────────────────────
router.post('/users', userAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        email,
        password: hashedPassword,
        role: role || 'READER',
      },
    });

    return res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// ── POST /auth/devices — cadastrar novo Android (só ADMIN) ───────────────────
router.post('/devices', userAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { name, token } = req.body;

  if (!name || !token) {
    return res.status(400).json({ error: 'name e token são obrigatórios' });
  }

  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const device = await prisma.device.create({
      data: { id: uuidv4(), name, tokenHash },
    });
    return res.status(201).json({ id: device.id, name: device.name });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Token já cadastrado' });
    }
    return res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
