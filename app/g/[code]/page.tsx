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
        <h1>Hmm 🤔</h1>
        <p>
          There&apos;s no game with code <strong>{code}</strong>. It may have
          expired.
        </p>
        <Link href="/">← Back home</Link>
      </>
    );
  }

  if (!status) {
    return <p className="center">Loading…</p>;
  }

  if (status.revealed) {
    return (
      <>
        <div className="code-badge">{code}</div>
        <div className="card center">
          <h2>Submissions are closed 🎤</h2>
          <p>
            The host is reading the list. Listen up and remember the names —
            you won&apos;t hear them again!
          </p>
        </div>
        <p className="center">
          <Link href="/">Start another game</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="code-badge">{code}</div>

      {submittedCount > 0 && (
        <p className="success center">
          You&apos;re in! You&apos;ve submitted {submittedCount}{" "}
          {submittedCount === 1 ? "name" : "names"}.
        </p>
      )}

      <div className="card">
        <h2>{submittedCount > 0 ? "Add another name" : "Submit a name"}</h2>
        <p>
          Nobody will see who submitted what — that&apos;s the whole game.
        </p>
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
