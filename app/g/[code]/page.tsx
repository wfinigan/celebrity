"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";

type Status = {
  count: number;
  revealed: boolean;
};

export default function PlayerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const code = use(params).code.toUpperCase();
  const [status, setStatus] = useState<Status | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/${code}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setSubmittedCount((n) => n + 1);
      setName("");
      setStatus((s) => (s ? { ...s, count: data.count } : s));
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      refresh();
    } finally {
      setSubmitting(false);
    }
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

  if (!status) {
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

  return (
    <>
      <header>
        <p className="eyebrow">Game {code}</p>
        <h1>Put a name in the hat</h1>
        <p className="lede" style={{ marginTop: "0.6rem" }}>
          Nobody sees who submitted what — that&apos;s the whole game.
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
            : submittedCount > 0
              ? "Add another name"
              : "Put it in the hat"}
        </button>
        {submittedCount > 0 && (
          <p className="success">
            You&apos;re in — {submittedCount}{" "}
            {submittedCount === 1 ? "name" : "names"} submitted.
          </p>
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
