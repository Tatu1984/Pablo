import { hashPassword, verifyPassword } from "@/backend/utils/hash.util";
import { newId } from "@/backend/utils/id.util";
import { autoProvisionDefaultProvider } from "@/backend/services/provider.service";
import { signSession, type SessionPayload } from "@/backend/utils/jwt.util";
import {
  findUserByEmail,
  findUserById,
  insertUser,
} from "@/backend/repositories/user.repository";
import { insertOrg, insertOrgMember, findOrgForUser } from "@/backend/repositories/org.repository";
import type { RegisterInput, LoginInput } from "@/backend/validators/auth.validator";
import type { Org, User } from "@/shared/types/user.types";

export class AuthError extends Error {
  constructor(
    public code: "email_taken" | "invalid_credentials",
    message: string,
  ) {
    super(message);
  }
}

export async function register(input: RegisterInput): Promise<{
  user: User;
  org: Org;
  token: string;
}> {
  const existing = await findUserByEmail(input.email);
  if (existing) throw new AuthError("email_taken", "That email is already registered.");

  const passwordHash = await hashPassword(input.password);
  const userId = newId("user");
  const orgId = newId("org");

  const user = await insertUser(userId, input.email, passwordHash);
  const org = await insertOrg(orgId, input.org);
  await insertOrgMember(org.id, user.id, "owner");

  // Best-effort default provider — don't block signup if it fails.
  try {
    await autoProvisionDefaultProvider(org.id);
  } catch (err) {
    console.error("autoProvisionDefaultProvider failed for new org", org.id, err);
  }

  const token = await signSession({
    user_id: user.id,
    org_id: org.id,
    email: user.email,
  });
  return { user, org, token };
}

export async function login(
  input: LoginInput,
): Promise<{ user: User; org: Org; token: string }> {
  const row = await findUserByEmail(input.email);
  if (!row) throw new AuthError("invalid_credentials", "Wrong email or password.");

  const ok = await verifyPassword(row.password_hash, input.password);
  if (!ok) throw new AuthError("invalid_credentials", "Wrong email or password.");

  const org = await findOrgForUser(row.id);
  if (!org) throw new AuthError("invalid_credentials", "No organisation found for user.");

  const user: User = { id: row.id, email: row.email, created_at: row.created_at };
  const token = await signSession({ user_id: user.id, org_id: org.id, email: user.email });
  return { user, org, token };
}

export async function userFromSession(
  session: SessionPayload,
): Promise<{ user: User; org: Org } | null> {
  const user = await findUserById(session.user_id);
  if (!user) return null;
  const org = await findOrgForUser(user.id);
  if (!org || org.id !== session.org_id) return null;
  return { user, org };
}
