import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface AccessTokenPayload extends JWTPayload {
  sub: string;   // user UUID
  role: string;  // 'admin' | 'staff'
}

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

export async function signAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret());
  return payload as AccessTokenPayload;
}
