import { NextResponse, type NextRequest } from "next/server";
import { withV1Auth } from "../../_helpers";
import { getAgent } from "@/backend/repositories/agent.repository";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await withV1Auth(req);
  if ("error" in auth) return auth.error;
  const agent = await getAgent(auth.ctx.org_id, params.id);
  if (!agent) {
    return NextResponse.json(
      { type: "https://docs.pablo.ai/errors/not_found", title: "Not found", status: 404, code: "not_found" },
      { status: 404, headers: { "Content-Type": "application/problem+json" } },
    );
  }
  return NextResponse.json({ agent });
}
