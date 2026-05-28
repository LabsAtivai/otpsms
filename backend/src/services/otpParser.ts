export interface ParsedSms {
  code: string | null;
  service: string;
}

const SERVICE_MAP: Record<string, string> = {
  google: 'Google', gmail: 'Google',
  microsoft: 'Microsoft', azure: 'Azure',
  aws: 'AWS', amazon: 'Amazon',
  facebook: 'Facebook', instagram: 'Instagram',
  whatsapp: 'WhatsApp', twitter: 'Twitter',
  linkedin: 'LinkedIn', github: 'GitHub',
  gitlab: 'GitLab', dropbox: 'Dropbox',
  slack: 'Slack', discord: 'Discord',
  telegram: 'Telegram', paypal: 'PayPal',
  stripe: 'Stripe', mercadopago: 'MercadoPago',
  nubank: 'Nubank', itau: 'Itaú',
  bradesco: 'Bradesco', santander: 'Santander',
  bb: 'Banco do Brasil', caixa: 'Caixa',
  inter: 'Banco Inter',
};

const OTP_PATTERNS = [
  // Google format: G-039219 ou G-XXXXXX
  /\bG-(\d{4,8})\b/i,
  // "código: 123456" / "code: 123456"
  /(?:c[oó]digo|code|token|otp|senha|pin|verification|verify|verification code)[\s:é\-]*([A-Z0-9]{4,8})\b/i,
  // "use 123456 to verify"
  /(?:use|enter|digite|informe)\s+([A-Z0-9]{4,8})\b/i,
  // "123456 is your code"
  /\b([A-Z0-9]{4,8})\s+(?:is your|é seu|é o seu)/i,
  // Número isolado 4-8 dígitos — fallback
  /(?<!\d)(\d{4,8})(?!\d)/,
];

export function extractOtp(message: string): string | null {
  // Primeiro tenta padrão G-XXXXXX do Google
  const googleMatch = message.match(/\bG-(\d{4,8})\b/i);
  if (googleMatch) return `G-${googleMatch[1]}`;

  for (const pattern of OTP_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export function classifyService(sender: string, message: string): string {
  const senderLower = sender.toLowerCase();
  for (const [key, name] of Object.entries(SERVICE_MAP)) {
    if (senderLower.includes(key)) return name;
  }
  const msgLower = message.toLowerCase();
  for (const [key, name] of Object.entries(SERVICE_MAP)) {
    if (msgLower.includes(key)) return name;
  }
  return 'Desconhecido';
}
