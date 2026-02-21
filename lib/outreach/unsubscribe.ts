import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/env.mjs';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function signaturePayload(contactId: string, email: string): string {
  return `${contactId}:${normalizeEmail(email)}`;
}

export function createUnsubscribeToken(
  contactId: string,
  email: string,
): string {
  return createHmac('sha256', env.ADMIN_SECRET)
    .update(signaturePayload(contactId, email))
    .digest('hex');
}

export function verifyUnsubscribeToken(
  contactId: string,
  email: string,
  token: string,
): boolean {
  if (!token) return false;
  const expected = createUnsubscribeToken(contactId, email);
  if (expected.length !== token.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}
