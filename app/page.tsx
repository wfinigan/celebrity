"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Status =
  | { active: false }
  | { active: true; gameId: number; count: number; revealed: boolean };

export default function PlayerPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const gameIdRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/game");
      if (!res.ok) return;
      const data: Status = await res.json();
      // A fresh game replaced the old one — reset local state.
      if (data.active && gameIdRef.current !== data.gameId) {
        gameIdRef.current = data.gameId;
        setSubmittedCount(0);
        setError(null);
      }
      setStatus(data);
    } catch {
      // transient network error — next poll will retry
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/game/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setSubmittedCount((n) => n + 1);
      setName("");
      setStatus((s) =>
        s && s.active ? { ...s, count: data.count } : s
      );
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!status) {
    return <p className="center">Loading…</p>;
  }

  if (!status.active) {
    return (
      <>
        <h1>Celebrity 🌟</h1>
        <p>
          Everyone puts a name in the hat, the host reads them aloud, and you
          remember — then guess who said who.
        </p>
        <div className="card center">
          <h2>No game right now</h2>
          <p>Waiting for the host to start one…</p>
        </div>
        <p className="center">
          <Link href="/host">I&apos;m the host →</Link>
        </p>
      </>
    );
  }

  if (status.revealed) {
    return (
      <>
        <h1>Celebrity 🌟</h1>
        <div className="card center">
          <h2>Submissions are closed 🎤</h2>
          <p>
            The list is being read. Listen up and remember the names — you
            won&apos;t hear them again!
          </p>
        </div>
        <p className="center" style={{ color: "var(--muted)" }}>
          This page will reset when a new game starts.
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Celebrity 🌟</h1>

      {submittedCount > 0 && (
        <p className="success center">
          You&apos;re in! You&apos;ve submitted {submittedCount}{" "}
          {submittedCount === 1 ? "name" : "names"}.
        </p>
      )}

      <div className="card">
        <h2>{submittedCount > 0 ? "Add another name" : "Put a name in the hat"}</h2>
        <p>Nobody will see who submitted what — that&apos;s the whole game.</p>
        <form
          onSubmit={submit}
          style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
        >
          <input
            ref={inputRef}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dolly Parton"
            maxLength={60}
            autoFocus
          />
          <button
            className="button"
            type="submit"
            disabled={submitting || !name.trim()}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      <div>
        <div className="count">{status.count}</div>
        <p className="count-label">
          {status.count === 1 ? "name" : "names"} in the hat
        </p>
      </div>
    </>
  );
}
