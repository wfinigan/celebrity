import { NextRequest, NextResponse } from "next/server";
import { isValidCode, normalizeCode, shuffle } from "@/lib/game";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const code = normalizeCode((await params).code);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid game code." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const store = getStore();
  const game = await store.getGame(code);
  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }
  if (body?.hostToken !== game.hostToken) {
    return NextResponse.json(
      { error: "Only the host can reveal the list." },
      { status: 403 }
    );
  }

  if (!game.revealed) {
    const submissions = await store.getSubmissions(code);
    if (submissions.length === 0) {
      return NextResponse.json(
        { error: "No names have been submitted yet." },
        { status: 409 }
      );
    }
    game.revealed = true;
    game.order = shuffle(submissions);
    game.served = 0;
    game.locked = false;
    await store.setGame(code, game);
  }

  // Deliberately no names here — the reader gets them one at a time
  // via the /next endpoint.
  return NextResponse.json({ ok: true, total: game.order.length });
}
