"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";

type Status = {
  count: number;
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

export default function PlayerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const code = use(params).code.toUpperCase();
  const [status, setStatus] = useState<Status | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [name, setName] = useState("");
  // The name this player has in the hat, if any.
  const [myName, setMyName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPlayerId(getOrCreatePlayerId(code));
    setMyName(localStorage.getItem(`celebrity-myname-${code}`));
  }, [code]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !playerId) return;
    setSubmitting(true);
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
      setStatus((s) => (s ? { ...s, count: data.count } : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      refresh();
    } finally {
      setSubmitting(false);
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

  // Already in the hat, not editing: show the name with a change option.
  if (myName && !editing) {
    return (
      <>
        <header>
          <p className="eyebrow">Game {code}</p>
          <h1>You&apos;re in</h1>
          <p className="lede" style={{ marginTop: "0.6rem" }}>
            Your name is in the hat. One per person — but you can change it
            until the hat closes.
          </p>
        </header>

        <div className="flashcard" style={{ minHeight: "20vh" }}>
          {myName}
        </div>

        <button className="button button-secondary" onClick={startEditing}>
          Change your name
        </button>

        <hr className="rule" />

        <div>
          <div className="count">{status.count}</div>
          <p className="count-label">
            {status.count === 1 ? "name" : "names"} in the hat
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <header>
        <p className="eyebrow">Game {code}</p>
        <h1>{myName ? "Change your name" : "Put a name in the hat"}</h1>
        <p className="lede" style={{ marginTop: "0.6rem" }}>
          One name per person. Nobody sees who submitted what — that&apos;s
          the whole game.
        </p>
      </header>

      <form className="stack" onSubmit={submit}>
        <input
          ref={inputRef}
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
          disabled={submitting || !name.trim()}
        >
          {submitting
            ? "Submitting…"
            : myName
              ? "Replace it"
              : "Put it in the hat"}
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

      <hr className="rule" />

      <div>
        <div className="count">{status.count}</div>
        <p className="count-label">
          {status.count === 1 ? "name" : "names"} in the hat
        </p>
      </div>
    </>
  );
}
