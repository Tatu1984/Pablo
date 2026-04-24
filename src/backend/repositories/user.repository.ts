import { query } from "@/backend/database/client";
import type { User } from "@/shared/types/user.types";

interface UserWithHashRow extends User {
  password_hash: string;
}

export async function findUserByEmail(email: string): Promise<UserWithHashRow | null> {
  const rows = await query<UserWithHashRow>(
    `SELECT id, email, password_hash,
            to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const rows = await query<User>(
    `SELECT id, email,
            to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function insertUser(
  id: string,
  email: string,
  passwordHash: string,
): Promise<User> {
  const rows = await query<User>(
    `INSERT INTO users (id, email, password_hash)
     VALUES ($1, lower($2), $3)
     RETURNING id, email,
               to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
    [id, email, passwordHash],
  );
  return rows[0];
}
