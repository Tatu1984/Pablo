import { SignJWT, jwtVerify } from "jose";

export interface SessionPayload {
  user_id: string;
  org_id: string;
  email: string;
}

const ISSUER = "pablo";
const AUDIENCE = "pablo-web";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const p = payload as unknown as SessionPayload;
    if (!p.user_id || !p.org_id || !p.email) return null;
    return { user_id: p.user_id, org_id: p.org_id, email: p.email };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "pablo_session";
export const SESSION_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;
