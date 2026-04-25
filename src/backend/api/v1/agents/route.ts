import { NextResponse, type NextRequest } from "next/server";
import { withV1Auth } from "../_helpers";
import { getAgents } from "@/backend/repositories/agent.repository";

export async function GET(req: NextRequest) {
  const auth = await withV1Auth(req);
  if ("error" in auth) return auth.error;
  const agents = await getAgents(auth.ctx.org_id);
  return NextResponse.json({ data: agents });
}
