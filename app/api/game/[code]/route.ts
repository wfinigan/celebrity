import { NextRequest, NextResponse } from "next/server";
import { isValidCode, normalizeCode } from "@/lib/game";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const code = normalizeCode((await params).code);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid game code." }, { status: 400 });
  }

  const store = getStore();
  const game = await store.getGame(code);
  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }

  const submissions = await store.getSubmissions(code);
  const isHost =
    request.nextUrl.searchParams.get("hostToken") === game.hostToken;

  return NextResponse.json({
    count: submissions.length,
    revealed: game.revealed,
    // The name list is only ever sent to the host.
    ...(isHost && game.revealed ? { names: game.order } : {}),
    ...(isHost ? { isHost: true } : {}),
  });
}
