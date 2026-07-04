import { NextRequest, NextResponse } from "next/server";
import {
  cleanName,
  isValidCode,
  isValidPlayerId,
  normalizeCode,
} from "@/lib/game";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// A player signs up with their own name, so everyone can see who's in.
// Joining again with the same player id just updates the name.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const code = normalizeCode((await params).code);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid game code." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const name = cleanName(body?.name);
  if (!name) {
    return NextResponse.json(
      { error: "Please enter your name (60 characters max)." },
      { status: 400 }
    );
  }
  if (!isValidPlayerId(body?.playerId)) {
    return NextResponse.json(
      { error: "Missing player id — reload the page and try again." },
      { status: 400 }
    );
  }

  const store = getStore();
  const game = await store.getGame(code);
  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }
  if (game.revealed) {
    return NextResponse.json(
      { error: "The hat is closed — this round has started." },
      { status: 409 }
    );
  }

  await store.setPlayer(code, body.playerId, name);
  return NextResponse.json({ ok: true });
}
