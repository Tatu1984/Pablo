import { NextResponse, type NextRequest } from "next/server";
import { withV1Auth } from "../../_helpers";
import { getRun, getTrace } from "@/backend/repositories/run.repository";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await withV1Auth(req);
  if ("error" in auth) return auth.error;
  const [run, trace] = await Promise.all([
    getRun(auth.ctx.org_id, params.id),
    getTrace(auth.ctx.org_id, params.id),
  ]);
  if (!run) {
    return NextResponse.json(
      { type: "https://docs.pablo.ai/errors/not_found", title: "Not found", status: 404, code: "not_found" },
      { status: 404, headers: { "Content-Type": "application/problem+json" } },
    );
  }
  return NextResponse.json({ run, trace });
}
