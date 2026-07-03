import { NextRequest, NextResponse } from "next/server";
import { generateHostToken } from "@/lib/game";
import { getStore, MAX_PASSES } from "@/lib/store";

export const dynamic = "force-dynamic";

// Start a new game, replacing whatever game came before.
export async function POST() {
  const store = getStore();
  const hostToken = generateHostToken();
  await store.resetGame({
    hostToken,
    revealed: false,
    order: [],
    served: 0,
    createdAt: Date.now(),
  });
  return NextResponse.json({ hostToken });
}

export async function GET(request: NextRequest) {
  const store = getStore();
  const game = await store.getGame();
  if (!game) {
    return NextResponse.json({ active: false });
  }

  const submissions = await store.getSubmissions();
  const isHost =
    request.nextUrl.searchParams.get("hostToken") === game.hostToken;

  const total = game.order.length;
  return NextResponse.json({
    active: true,
    // Lets clients notice when a fresh game has replaced the one they knew.
    gameId: game.createdAt,
    count: submissions.length,
    revealed: game.revealed,
    ...(isHost ? { isHost: true } : {}),
    // Reading progress, so a page refresh resumes where the reader left off.
    // Never the full list — the reader only ever gets one name at a time.
    ...(isHost && game.revealed
      ? {
          total,
          served: game.served,
          // The name currently on screen, so a mid-read refresh resumes on
          // it — but once both passes are done, nothing comes back.
          currentName:
            game.served > 0 && game.served < total * MAX_PASSES
              ? game.order[(game.served - 1) % total]
              : null,
          maxPasses: MAX_PASSES,
        }
      : {}),
  });
}
