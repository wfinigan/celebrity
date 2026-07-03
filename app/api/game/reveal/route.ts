import { NextRequest, NextResponse } from "next/server";
import { shuffle } from "@/lib/game";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const store = getStore();
  const game = await store.getGame();
  if (!game) {
    return NextResponse.json(
      { error: "There's no game right now." },
      { status: 404 }
    );
  }
  if (body?.hostToken !== game.hostToken) {
    return NextResponse.json(
      { error: "Only the host can close submissions." },
      { status: 403 }
    );
  }

  if (!game.revealed) {
    const submissions = await store.getSubmissions();
    if (submissions.length === 0) {
      return NextResponse.json(
        { error: "No names have been submitted yet." },
        { status: 409 }
      );
    }
    game.revealed = true;
    game.order = shuffle(submissions);
    game.served = 0;
    await store.setGame(game);
  }

  // Deliberately no names here — the reader gets them one at a time
  // via the /next endpoint.
  return NextResponse.json({ ok: true, total: game.order.length });
}
