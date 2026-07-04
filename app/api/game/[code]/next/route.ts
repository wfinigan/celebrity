import { NextRequest, NextResponse } from "next/server";
import { isValidCode, normalizeCode } from "@/lib/game";
import { getStore, MAX_PASSES } from "@/lib/store";

export const dynamic = "force-dynamic";

// Deals the next name to the reader. Names are served strictly one at a
// time, in the shuffled order, for at most MAX_PASSES passes through the
// list. Progress lives server-side so refreshing the page can't reset it.
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
      { error: "Only the reader can see the names." },
      { status: 403 }
    );
  }
  if (!game.revealed) {
    return NextResponse.json(
      { error: "Submissions haven't been closed yet." },
      { status: 409 }
    );
  }

  const total = game.order.length;
  if (game.locked) {
    return NextResponse.json({ done: true, total, served: game.served });
  }
  if (game.served >= total * MAX_PASSES) {
    // The reader confirmed past the last name — lock the list for good.
    game.locked = true;
    await store.setGame(code, game);
    return NextResponse.json({ done: true, total, served: game.served });
  }

  game.served += 1;
  await store.setGame(code, game);

  return NextResponse.json({
    name: game.order[(game.served - 1) % total],
    served: game.served,
    total,
    done: false,
  });
}
