import { NextResponse, type NextRequest } from "next/server";
import { withV1Auth } from "../../../_helpers";
import { cancelRun } from "@/backend/repositories/run.repository";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await withV1Auth(req);
  if ("error" in auth) return auth.error;
  const run = await cancelRun(auth.ctx.org_id, params.id);
  if (!run) {
    return NextResponse.json(
      {
        type: "https://docs.pablo.ai/errors/not_cancellable",
        title: "Cannot cancel",
        status: 409,
        code: "not_cancellable",
        detail: "Run not found or already terminal.",
      },
      { status: 409, headers: { "Content-Type": "application/problem+json" } },
    );
  }
  return NextResponse.json({ run });
}
