"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

type Player = { name: string; submitted: boolean };

type Status = {
  count: number;
  players: Player[];
  revealed: boolean;
};

function getOrCreatePlayerId(code: string): string {
  const key = `celebrity-player-${code}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Array.from({ length: 4 }, () =>
            Math.random().toString(36).slice(2, 10)
          ).join("-");
    localStorage.setItem(key, id);
  }
  return id;
}

function Roster({ players }: { players: Player[] }) {
  if (players.length === 0) {
    return <p className="hint">Nobody has signed up yet.</p>;
  }
  return (
    <ul className="roster">
      {players.map((p, i) => (
        <li key={i}>
          <span className="who">{p.name}</span>
          <span className={p.submitted ? "chip chip-ok" : "chip"}>
            {p.submitted ? "In the hat" : "Thinking…"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function PlayerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const code = use(params).code.toUpperCase();
  const [status, setStatus] = useState<Status | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  // The player's own name, once they've signed up.
  const [me, setMe] = useState<string | null>(null);
  const [meInput, setMeInput] = useState("");
  // The celebrity name this player has in the hat, if any.
  const [myName, setMyName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(getOrCreatePlayerId(code));
    setMe(localStorage.getItem(`celebrity-me-${code}`));
    setMyName(localStorage.getItem(`celebrity-myname-${code}`));
  }, [code]);

  // Re-announce ourselves on load so the roster is right even if the
  // server forgot us (e.g. this device signed up before a hiccup).
  useEffect(() => {
    if (!playerId || !me) return;
    fetch(`/api/game/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: me, playerId }),
    }).catch(() => {});
  }, [code, playerId, me]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${code}`);
      if (res.status === 404 || res.status === 400) {
        setNotFound(true);
        return;
      }
      if (res.ok) setStatus(await res.json());
    } catch {
      // transient network error — next poll will retry
    }
  }, [code]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (!meInput.trim() || !playerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: meInput, playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      const joined = meInput.trim().replace(/\s+/g, " ");
      setMe(joined);
      localStorage.setItem(`celebrity-me-${code}`, joined);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !playerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/${code}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      const submitted = name.trim().replace(/\s+/g, " ");
      setMyName(submitted);
      localStorage.setItem(`celebrity-myname-${code}`, submitted);
      setEditing(false);
      setName("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  function startEditing() {
    setName(myName ?? "");
    setEditing(true);
    setError(null);
  }

  if (notFound) {
    return (
      <>
        <header>
          <p className="eyebrow">Game {code}</p>
          <h1>Nothing here</h1>
        </header>
        <p className="lede">
          There&apos;s no game with this code. It may have expired — check the
          code with your host.
        </p>
        <p>
          <Link href="/">Back to the start</Link>
        </p>
      </>
    );
  }

  if (!status || !playerId) {
    return <p className="hint center">Loading…</p>;
  }

  if (status.revealed) {
    return (
      <>
        <header>
          <p className="eyebrow">Game {code}</p>
          <h1>The hat is closed</h1>
        </header>
        <p className="lede">
          The list is being read. Listen carefully and remember the names —
          you won&apos;t hear them again.
        </p>
        <hr className="rule" />
        <p className="hint">
          This page resets when a new game starts.{" "}
          <Link href="/">Or start one yourself</Link>.
        </p>
      </>
    );
  }

  // Step 1: sign up with your own name.
  if (!me) {
    return (
      <>
        <header>
          <p className="eyebrow">Game {code}</p>
          <h1>Who are you?</h1>
          <p className="lede" style={{ marginTop: "0.6rem" }}>
            Your name shows on the sign-up list, so everyone knows who&apos;s
            in.
          </p>
        </header>

        <form className="stack" onSubmit={signUp}>
          <input
            className="input"
            value={meInput}
            onChange={(e) => setMeInput(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            maxLength={60}
            autoFocus
          />
          <button
            className="button"
            type="submit"
            disabled={busy || !meInput.trim()}
          >
            Sign up
          </button>
          {error && <p className="error">{error}</p>}
        </form>

        <hr className="rule" />

        <div className="stack">
          <p className="eyebrow">Signed up</p>
          <Roster players={status.players} />
        </div>
      </>
    );
  }

  // Step 2: put a celebrity name in the hat (or change it).
  const showForm = !myName || editing;

  return (
    <>
      <header>
        <p className="eyebrow">Game {code}</p>
        <h1>
          {showForm
            ? myName
              ? "Change your name"
              : "Put a name in the hat"
            : "You're in"}
        </h1>
        <p className="lede" style={{ marginTop: "0.6rem" }}>
          {showForm
            ? "One name per person. Nobody sees who submitted what — that's the whole game."
            : "Your name is in the hat. You can change it until the hat closes."}
        </p>
      </header>

      {showForm ? (
        <form className="stack" onSubmit={submit}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dolly Parton"
            aria-label="Celebrity name"
            maxLength={60}
            autoFocus
          />
          <button
            className="button"
            type="submit"
            disabled={busy || !name.trim()}
          >
            {busy ? "Submitting…" : myName ? "Replace it" : "Put it in the hat"}
          </button>
          {myName && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setEditing(false)}
            >
              Never mind, keep &ldquo;{myName}&rdquo;
            </button>
          )}
          {error && <p className="error">{error}</p>}
        </form>
      ) : (
        <>
          <div className="flashcard" style={{ minHeight: "16vh" }}>
            {myName}
          </div>
          <button className="button button-secondary" onClick={startEditing}>
            Change your name
          </button>
        </>
      )}

      <hr className="rule" />

      <div className="stack">
        <p className="eyebrow">
          {status.count} of {status.players.length} in the hat
        </p>
        <Roster players={status.players} />
      </div>
    </>
  );
}
