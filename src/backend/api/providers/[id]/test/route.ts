import { NextResponse, type NextRequest } from "next/server";
import { ProviderError, testProvider } from "@/backend/services/provider.service";
import { requireSession } from "@/backend/services/session.service";
import { badRequest, serverError, unauthorized } from "@/backend/utils/error-handler.util";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return unauthorized();
  }

  try {
    const result = await testProvider(session.org.id, params.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProviderError) return badRequest(err.code, err.message);
    console.error("testProvider failed:", err);
    return serverError();
  }
}
