import { NextRequest, NextResponse } from "next/server";
import { cleanName, isValidCode, normalizeCode } from "@/lib/game";
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
  const name = cleanName(body?.name);
  if (!name) {
    return NextResponse.json(
      { error: "Please enter a name (60 characters max)." },
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
      { error: "Submissions are closed — the list has been read!" },
      { status: 409 }
    );
  }

  await store.addSubmission(code, name);
  const submissions = await store.getSubmissions(code);
  return NextResponse.json({ ok: true, count: submissions.length });
}
