// Uygulamalar arası SSO "kimlik bileti" — saf crypto HMAC (bağımlılık yok).
// Portal bileti ÜRETİR (issueSsoTicket); hedef uygulamalar DOĞRULAR (verifySsoTicket).
// Ticket yalnızca KİMLİK (e-posta) taşır; yetki/oturum hedef tarafta Ortak DB'den yeniden doğrulanır.
// Tüm uygulamalarda AYNI SSO_SECRET olmalı. SSO_SECRET yoksa SSO devre dışıdır (null döner).
import crypto from 'crypto';

const SECRET = process.env.SSO_SECRET ?? '';

function sign(payloadB64: string): string {
  return crypto.createHmac('sha256', SECRET).update(payloadB64).digest('base64url');
}

/** Portal: kısa ömürlü (varsayılan 60 sn) imzalı bilet üretir. SSO kapalıysa null. */
export function issueSsoTicket(email: string, ttlSec = 60): string | null {
  if (!SECRET || !email) return null;
  const payloadB64 = Buffer.from(
    JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + ttlSec })
  ).toString('base64url');
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** Hedef uygulama: bileti doğrular. Geçersiz/süresi geçmiş/secret yok → null. */
export function verifySsoTicket(ticket: string | null | undefined): { email: string } | null {
  if (!SECRET || !ticket) return null;
  const dot = ticket.indexOf('.');
  if (dot < 0) return null;
  const payloadB64 = ticket.slice(0, dot);
  const sig = ticket.slice(dot + 1);

  // Sabit zamanlı imza karşılaştırması
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payloadB64));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: { email?: string; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload.email || typeof payload.exp !== 'number') return null;
  if (Math.floor(Date.now() / 1000) > payload.exp) return null;
  return { email: payload.email };
}

/** SSO_SECRET tanımlı mı? */
export function ssoEnabled(): boolean {
  return SECRET.length > 0;
}
