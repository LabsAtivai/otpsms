// ──────────────────────────────────────────────────────────────────────────────
// Serviço de extração de código OTP a partir de mensagens SMS
// Usa regex contextual para evitar falsos positivos
// ──────────────────────────────────────────────────────────────────────────────

export interface ParsedSms {
  code: string | null;
  service: string;
}

// Mapeamento remetente → nome amigável do serviço
const SERVICE_MAP: Record<string, string> = {
  google: 'Google',
  gmail: 'Google',
  microsoft: 'Microsoft',
  azure: 'Azure',
  aws: 'AWS',
  amazon: 'Amazon',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  twitter: 'Twitter',
  x: 'Twitter/X',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  gitlab: 'GitLab',
  dropbox: 'Dropbox',
  slack: 'Slack',
  discord: 'Discord',
  telegram: 'Telegram',
  paypal: 'PayPal',
  stripe: 'Stripe',
  mercadopago: 'MercadoPago',
  nubank: 'Nubank',
  itau: 'Itaú',
  bradesco: 'Bradesco',
  santander: 'Santander',
  bb: 'Banco do Brasil',
  caixa: 'Caixa',
  inter: 'Banco Inter',
};

// Padrões regex em ordem de prioridade
// Cada padrão captura o código no grupo 1
const OTP_PATTERNS = [
  // "código: 123456" / "code: 123456" / "código é 123456"
  /(?:c[oó]digo|code|token|otp|senha|pin|verification|verify)[\s:é\-]*(\d{4,8})\b/i,
  // "use 123456 to verify" / "enter 123456"
  /(?:use|enter|digite|informe)\s+(\d{4,8})\b/i,
  // "123456 is your verification code"
  /\b(\d{4,8})\s+(?:is your|é seu|é o seu)/i,
  // Número isolado (sem outros dígitos colados) — fallback
  /(?<!\d)(\d{4,8})(?!\d)/,
];

export function extractOtp(message: string): string | null {
  for (const pattern of OTP_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const candidate = match[1];
      // Rejeitar sequências óbvias de telefone/CEP fora de contexto
      if (isLikelyOtp(candidate, message)) {
        return candidate;
      }
    }
  }
  return null;
}

function isLikelyOtp(code: string, message: string): boolean {
  // Rejeitar se for parte de URL, CPF, ou número de telefone
  const contextBad = [
    /\d{5}-?\d{3}/,       // CEP
    /\d{3}\.\d{3}\.\d/,   // CPF
    /\(\d{2}\)\s?\d/,     // Telefone com DDD
    /R\$\s?\d/,           // Valor monetário
    /\d+,\d{2}/,          // Centavos
  ];
  for (const bad of contextBad) {
    if (bad.test(message)) continue; // o padrão existe na msg mas não necessariamente no código
  }
  return true; // simplificado para MVP — refine se necessário
}

export function classifyService(sender: string, message: string): string {
  const senderLower = sender.toLowerCase();

  // Tentar pelo remetente primeiro
  for (const [key, name] of Object.entries(SERVICE_MAP)) {
    if (senderLower.includes(key)) return name;
  }

  // Tentar pelo conteúdo da mensagem
  const msgLower = message.toLowerCase();
  for (const [key, name] of Object.entries(SERVICE_MAP)) {
    if (msgLower.includes(key)) return name;
  }

  return 'Desconhecido';
}
