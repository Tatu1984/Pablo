import { NextResponse, type NextRequest } from "next/server";
import { cancelRun } from "@/backend/repositories/run.repository";
import { requireSession } from "@/backend/services/session.service";
import {
  badRequest,
  serverError,
  unauthorized,
} from "@/backend/utils/error-handler.util";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return unauthorized();
  }

  try {
    const run = await cancelRun(session.org.id, params.id);
    if (!run) {
      return badRequest(
        "not_cancellable",
        "Run not found, or it has already finished.",
      );
    }
    return NextResponse.json({ run });
  } catch (err) {
    console.error("cancelRun failed:", err);
    return serverError();
  }
}
