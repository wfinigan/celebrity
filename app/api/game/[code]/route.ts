import { NextRequest, NextResponse } from "next/server";
import { isValidCode, normalizeCode } from "@/lib/game";
import { getStore, MAX_PASSES } from "@/lib/store";

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

  const [submissions, players] = await Promise.all([
    store.getSubmissions(code),
    store.getPlayers(code),
  ]);
  const isHost =
    request.nextUrl.searchParams.get("hostToken") === game.hostToken;

  // Who's in and whether their slip is in the hat — visible to everyone.
  // Celebrity names themselves are never in here.
  const roster = Object.entries(players)
    .map(([playerId, name]) => ({
      name,
      submitted: playerId in submissions,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const total = game.order.length;
  return NextResponse.json({
    count: Object.keys(submissions).length,
    players: roster,
    revealed: game.revealed,
    ...(isHost ? { isHost: true } : {}),
    // Reading progress, so a page refresh resumes where the reader left off.
    // Never the full list — the reader only ever gets one name at a time.
    ...(isHost && game.revealed
      ? {
          total,
          served: game.served,
          locked: game.locked,
          // The name currently on screen, so a mid-read refresh resumes on
          // it — but once the reader locks the list, nothing comes back.
          currentName:
            game.served > 0 && !game.locked
              ? game.order[(game.served - 1) % total]
              : null,
          maxPasses: MAX_PASSES,
        }
      : {}),
  });
}
