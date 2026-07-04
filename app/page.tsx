"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createGame() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/game", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      localStorage.setItem(`celebrity-host-${data.code}`, data.hostToken);
      router.push(`/host/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setCreating(false);
    }
  }

  function joinGame(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      setError("Game codes are 4 letters.");
      return;
    }
    router.push(`/g/${code}`);
  }

  return (
    <>
      <header>
        <p className="eyebrow">The name game</p>
        <h1>Celebrity</h1>
        <p className="lede" style={{ marginTop: "0.6rem" }}>
          Everyone puts a name in the hat. One person reads the list aloud —
          remember it, then guess who said who.
        </p>
      </header>

      <div className="stack">
        <button className="button" onClick={createGame} disabled={creating}>
          {creating ? "Starting…" : "Start a new game"}
        </button>
        <p className="hint">You&apos;ll get a code your friends join with.</p>
      </div>

      <div className="divider">or join a game</div>

      <form className="stack" onSubmit={joinGame}>
        <input
          className="input input-code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          aria-label="Game code"
          maxLength={4}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className="button button-secondary" type="submit">
          Join
        </button>
      </form>

      {error && <p className="error">{error}</p>}
    </>
  );
}
