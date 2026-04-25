import { NextResponse, type NextRequest } from "next/server";
import { getRun, getTrace } from "@/backend/repositories/run.repository";
import { requireSession } from "@/backend/services/session.service";
import { unauthorized } from "@/backend/utils/error-handler.util";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return unauthorized();
  }

  const [run, trace] = await Promise.all([
    getRun(session.org.id, params.id),
    getTrace(session.org.id, params.id),
  ]);
  if (!run) return new Response(null, { status: 404 });

  return NextResponse.json({ run, trace });
}
