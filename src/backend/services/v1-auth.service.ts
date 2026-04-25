import { type NextRequest } from "next/server";
import { verifyApiKey } from "@/backend/services/api-key.service";
import { findOrgForUser } from "@/backend/repositories/org.repository";
import { findUserById } from "@/backend/repositories/user.repository";
import { SESSION_COOKIE, verifySession } from "@/backend/utils/jwt.util";

// Resolves a request to an org context. Accepts either:
//   - Authorization: Bearer sk_live_…   (preferred for /v1)
//   - pablo_session cookie               (the dashboard uses this)
//
// Returns null if neither is valid.
export interface RequestContext {
  org_id: string;
  user_id: string | null;        // null when authed by API key
  api_key_id: string | null;
  source: "session" | "api_key";
}

export async function resolveRequestAuth(req: NextRequest): Promise<RequestContext | null> {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    const key = await verifyApiKey(token);
    if (key) {
      return {
        org_id: key.org_id,
        user_id: null,
        api_key_id: key.id,
        source: "api_key",
      };
    }
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie) {
    const session = await verifySession(cookie);
    if (session) {
      // We trust the JWT's org_id for routing but make sure the user/org
      // edge is still valid (covers revoked memberships).
      const user = await findUserById(session.user_id);
      const org = user ? await findOrgForUser(user.id) : null;
      if (user && org && org.id === session.org_id) {
        return {
          org_id: org.id,
          user_id: user.id,
          api_key_id: null,
          source: "session",
        };
      }
    }
  }

  return null;
}
