import { query } from "@/backend/database/client";
import type { Org, OrgMember } from "@/shared/types/user.types";

export async function insertOrg(id: string, name: string): Promise<Org> {
  const rows = await query<Org>(
    `INSERT INTO orgs (id, name, plan)
     VALUES ($1, $2, 'starter')
     RETURNING id, name, plan,
               to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
    [id, name],
  );
  return rows[0];
}

export async function insertOrgMember(
  orgId: string,
  userId: string,
  role: OrgMember["role"] = "owner",
): Promise<void> {
  await query(
    `INSERT INTO org_members (org_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [orgId, userId, role],
  );
}

export async function findOrgForUser(userId: string): Promise<Org | null> {
  const rows = await query<Org>(
    `SELECT o.id, o.name, o.plan,
            to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM orgs o
       JOIN org_members m ON m.org_id = o.id
      WHERE m.user_id = $1
      ORDER BY o.created_at ASC
      LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}
