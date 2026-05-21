import rateLimit from 'express-rate-limit';

// Rate limit para o endpoint que o Android chama
export const smsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30,             // máximo 30 SMS por minuto (muito mais que suficiente)
  message: { error: 'Muitas requisições' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit para login (anti-brute force)
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                  // 10 tentativas
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
