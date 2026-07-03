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
      <div>
        <h1>Celebrity 🌟</h1>
        <p>
          Everyone submits a name. The host reads the list aloud — remember
          them, then guess who said who.
        </p>
      </div>

      <div className="card">
        <h2>Host a game</h2>
        <p>Get a room code your friends can join.</p>
        <button className="button" onClick={createGame} disabled={creating}>
          {creating ? "Creating…" : "Start a new game"}
        </button>
      </div>

      <div className="card">
        <h2>Join a game</h2>
        <form
          onSubmit={joinGame}
          style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
        >
          <input
            className="input input-code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={4}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="button button-secondary" type="submit">
            Join
          </button>
        </form>
      </div>

      {error && <p className="error center">{error}</p>}
    </>
  );
}
