import { hashPasswordScrypt, verifyPasswordConstantTime } from '@/lib/password-hash';
import { VipMember } from '@/types/store';

/**
 * Validate that a VIP wallet PIN consists of exactly 4 numeric digits.
 */
export function validateVipPinFormat(pin: unknown): boolean {
  if (typeof pin !== 'string') return false;
  const trimmed = pin.trim();
  return /^\d{4}$/.test(trimmed);
}

/**
 * Cryptographically hash a 4-digit VIP PIN using scrypt.
 */
export function hashVipPin(pin: string): string {
  const trimmed = String(pin || '').trim();
  if (!validateVipPinFormat(trimmed)) {
    throw new Error('الرمز السري لمحفظة VIP يجب أن يتكون من 4 أرقام عددية فقط (0-9)');
  }
  return hashPasswordScrypt(trimmed);
}

/**
 * Verify a candidate 4-digit PIN against a stored scrypt/sha256 hash in constant time.
 */
export function verifyVipPin(candidatePin: string, storedHash: string): boolean {
  if (!candidatePin || !storedHash) return false;
  const trimmed = String(candidatePin).trim();
  return verifyPasswordConstantTime(trimmed, storedHash);
}

/**
 * Sanitize a VipMember object for client-facing responses:
 * Strictly strips `pinHash` to prevent hash leakage, and adds `hasPin: boolean`.
 */
export function sanitizeVipMember<T extends VipMember>(
  member: T
): Omit<T, 'pinHash'> & { hasPin: boolean } {
  const { pinHash, ...safeMember } = member;
  return {
    ...safeMember,
    hasPin: Boolean(pinHash),
  };
}
