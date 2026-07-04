import { NextResponse } from "next/server";
import { generateCode, generateHostToken } from "@/lib/game";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  const store = getStore();

  // Retry on the (unlikely) chance of a code collision with a live game.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    if (await store.getGame(code)) continue;

    const hostToken = generateHostToken();
    await store.createGame(code, {
      hostToken,
      revealed: false,
      order: [],
      served: 0,
      locked: false,
      createdAt: Date.now(),
    });
    return NextResponse.json({ code, hostToken });
  }

  return NextResponse.json(
    { error: "Could not create a game, please try again." },
    { status: 500 }
  );
}
