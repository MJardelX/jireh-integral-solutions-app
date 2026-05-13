import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

export const SESSION_EXPIRY_MS    = 1  * 24 * 60 * 60 * 1000; // 1 day  (session-only; cookie dies sooner)
export const PERSISTENT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (keep me signed in)
export const REFRESH_TOKEN_EXPIRY_MS = PERSISTENT_EXPIRY_MS;   // backward-compat alias

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function storeRefreshToken(
  userId: string,
  token: string,
  family: string,
  expiresAt: Date
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from('refresh_tokens').insert({
    user_id: userId,
    token_hash: hashToken(token),
    family,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error('Failed to store refresh token');
}

/**
 * Validates and rotates a refresh token.
 * Returns the family UUID on success, null on any failure.
 *
 * If the token was already revoked we detect a reuse attack:
 * the entire family is immediately invalidated.
 */
export async function rotateRefreshToken(
  oldToken: string,
  userId: string,
  newToken: string,
  expiresAt: Date
): Promise<{ family: string } | null> {
  const db = createAdminClient();
  const oldHash = hashToken(oldToken);

  const { data: existing } = await db
    .from('refresh_tokens')
    .select('id, family, revoked, expires_at, user_id')
    .eq('token_hash', oldHash)
    .single();

  if (!existing) return null;

  // Reuse attack — revoke the entire token family
  if (existing.revoked) {
    await db
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('family', existing.family);
    return null;
  }

  if (new Date(existing.expires_at) < new Date()) return null;
  if (existing.user_id !== userId) return null;

  // Revoke old token, store new one in the same family
  await db.from('refresh_tokens').update({ revoked: true }).eq('id', existing.id);
  await storeRefreshToken(userId, newToken, existing.family, expiresAt);

  return { family: existing.family };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const db = createAdminClient();
  await db
    .from('refresh_tokens')
    .update({ revoked: true })
    .eq('token_hash', hashToken(token));
}

export async function getRefreshTokenRecord(token: string) {
  const db = createAdminClient();
  const { data } = await db
    .from('refresh_tokens')
    .select('id, user_id, family, revoked, expires_at')
    .eq('token_hash', hashToken(token))
    .single();
  return data;
}
