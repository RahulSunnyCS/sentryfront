/**
 * Password hashing utilities.
 *
 * Uses Node's built-in scrypt (a memory-hard KDF) so no native or
 * third-party dependency is required. Stored format:
 *
 *   scrypt$N$<saltHex>$<hashHex>
 *
 * Verification is constant-time via crypto.timingSafeEqual.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 64;
const SALT_BYTES = 16;
const SCHEME = 'scrypt';
const N = 16384; // CPU/memory cost — matches scrypt's default work factor

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(plain, salt, KEY_LEN);
  return `${SCHEME}$${N}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== SCHEME) return false;

  const saltHex = parts[2];
  const hashHex = parts[3];
  if (!saltHex || !hashHex) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }

  const derived = await scryptAsync(plain, salt, expected.length);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
