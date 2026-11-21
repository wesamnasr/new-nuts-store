import crypto from 'crypto';

export function hashPasswordScrypt(plainPassword: string): string {
  if (plainPassword.startsWith('scrypt$') && plainPassword.split('$').length === 3) {
    return plainPassword;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPasswordConstantTime(
  candidatePassword: string,
  storedPassword: string
): boolean {
  if (!candidatePassword || !storedPassword) return false;
  if (storedPassword.startsWith('scrypt$')) {
    const parts = storedPassword.split('$');
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    const derived = crypto.scryptSync(candidatePassword, salt, 64);
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  }
  const candHash = crypto.createHash('sha256').update(candidatePassword).digest();
  const storedHash = crypto.createHash('sha256').update(storedPassword).digest();
  return crypto.timingSafeEqual(candHash, storedHash);
}

export function computeSettingsFingerprint(secret: string): string {
  return crypto.createHash('sha256').update(String(secret || '')).digest('hex').slice(0, 24);
}
