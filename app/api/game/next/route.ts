import { NextRequest, NextResponse } from "next/server";
import { getStore, MAX_PASSES } from "@/lib/store";

export const dynamic = "force-dynamic";

// Deals the next name to the reader. Names are served strictly one at a
// time, in the shuffled order, for at most MAX_PASSES passes through the
// list. Progress lives server-side so refreshing the page can't reset it.
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
  if (game.served >= total * MAX_PASSES) {
    return NextResponse.json({ done: true, total, served: game.served });
  }

  game.served += 1;
  await store.setGame(game);

  return NextResponse.json({
    name: game.order[(game.served - 1) % total],
    served: game.served,
    total,
    done: game.served >= total * MAX_PASSES,
  });
}
