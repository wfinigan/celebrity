import { NextRequest, NextResponse } from "next/server";
import { cleanName } from "@/lib/game";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = cleanName(body?.name);
  if (!name) {
    return NextResponse.json(
      { error: "Please enter a name (60 characters max)." },
      { status: 400 }
    );
  }

  const store = getStore();
  const game = await store.getGame();
  if (!game) {
    return NextResponse.json(
      { error: "There's no game right now." },
      { status: 404 }
    );
  }
  if (game.revealed) {
    return NextResponse.json(
      { error: "Submissions are closed — the list is being read!" },
      { status: 409 }
    );
  }

  await store.addSubmission(name);
  const submissions = await store.getSubmissions();
  return NextResponse.json({ ok: true, count: submissions.length });
}
