"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

type Status = {
  count: number;
  revealed: boolean;
  isHost?: boolean;
  // Present once revealed:
  total?: number;
  served?: number;
  currentName?: string | null;
  maxPasses?: number;
};

export default function HostPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const code = use(params).code.toUpperCase();
  const [hostToken, setHostToken] = useState<string | null | undefined>(
    undefined
  );
  const [status, setStatus] = useState<Status | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHostToken(localStorage.getItem(`celebrity-host-${code}`));
    setJoinUrl(`${window.location.origin}/g/${code}`);
  }, [code]);

  const refresh = useCallback(async () => {
    if (!hostToken) return;
    try {
      const res = await fetch(
        `/api/game/${code}?hostToken=${encodeURIComponent(hostToken)}`
      );
      if (res.status === 404 || res.status === 400) {
        setNotFound(true);
        return;
      }
      if (res.ok) setStatus(await res.json());
    } catch {
      // transient network error — next poll will retry
    }
  }, [code, hostToken]);

  // Poll for the submission count in the lobby. Once reading starts,
  // stop polling — progress is driven by the "next" clicks.
  useEffect(() => {
    refresh();
    if (status?.revealed) return;
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh, status?.revealed]);

  async function reveal() {
    if (!hostToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/${code}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setStatus((s) =>
        s
          ? {
              ...s,
              revealed: true,
              total: data.total,
              served: 0,
              currentName: null,
            }
          : s
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function nextName() {
    if (!hostToken || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/${code}/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setStatus((s) =>
        s
          ? {
              ...s,
              served: data.served,
              total: data.total,
              currentName: data.name ?? s.currentName,
            }
          : s
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the link is shown as text anyway
    }
  }

  if (hostToken === null) {
    return (
      <>
        <h1>Not the host 🙅</h1>
        <p>
          This device didn&apos;t create game <strong>{code}</strong>, so it
          can&apos;t see the reader view. If you&apos;re a player,{" "}
          <Link href={`/g/${code}`}>join here</Link>.
        </p>
        <Link href="/">← Back home</Link>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <h1>Game not found 🤔</h1>
        <p>
          Game <strong>{code}</strong> doesn&apos;t exist or has expired.
        </p>
        <Link href="/">← Back home</Link>
      </>
    );
  }

  if (!status) {
    return <p className="center">Loading…</p>;
  }

  // ----- Reading phase: one name at a time, two passes max -----
  if (status.revealed && status.total) {
    const total = status.total;
    const served = status.served ?? 0;
    const maxPasses = status.maxPasses ?? 2;
    const finished = served >= total * maxPasses;
    const pass = served === 0 ? 1 : Math.floor((served - 1) / total) + 1;
    const indexInPass = served === 0 ? 0 : ((served - 1) % total) + 1;
    const atEndOfPass = indexInPass === total;
    const onLastPass = pass === maxPasses;

    if (finished) {
      return (
        <>
          <div className="code-badge">{code}</div>
          <div className="card center">
            <h2>The list is gone 🧠</h2>
            <p>
              All {total} names were read {maxPasses} times. No peeking — now
              go around the room and guess who said who!
            </p>
          </div>
          <p className="center">
            <Link href="/">Start another game</Link>
          </p>
        </>
      );
    }

    if (served === 0) {
      return (
        <>
          <div className="code-badge">{code}</div>
          <div className="card center">
            <h2>Ready to read? 📣</h2>
            <p>
              {total} {total === 1 ? "name is" : "names are"} in the hat.
              You&apos;ll see one name at a time — never the whole list. You
              can go through it {maxPasses} times, then it&apos;s gone for
              good (you&apos;re playing too, no unfair advantage!).
            </p>
            <p>Make sure everyone is listening, then start.</p>
            <button className="button" onClick={nextName} disabled={busy}>
              Show the first name
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        </>
      );
    }

    return (
      <>
        <div className="flash-meta">
          Name {indexInPass} of {total} · read-through {pass} of {maxPasses}
        </div>
        <div className="card flashcard">{status.currentName}</div>
        {atEndOfPass ? (
          <div className="card center">
            <h2>
              {onLastPass ? "End of the final read 🔒" : "End of the list!"}
            </h2>
            <p>
              {onLastPass
                ? "Once you continue, the names are gone forever."
                : "You can read through one more time — after that the list is gone."}
            </p>
            <button className="button" onClick={nextName} disabled={busy}>
              {onLastPass ? "Finish — lock the list" : "Read through again"}
            </button>
          </div>
        ) : (
          <button className="button" onClick={nextName} disabled={busy}>
            Next name →
          </button>
        )}
        {error && <p className="error center">{error}</p>}
      </>
    );
  }

  // ----- Lobby phase: collect submissions -----
  return (
    <>
      <div>
        <p className="center">Your game code</p>
        <div className="code-badge">{code}</div>
      </div>

      <div className="card">
        <h2>Invite your friends</h2>
        <p className="share-link">{joinUrl}</p>
        <button className="button button-secondary" onClick={copyLink}>
          {copied ? "Copied! ✓" : "Copy link"}
        </button>
      </div>

      <div>
        <div className="count">{status.count}</div>
        <p className="count-label">
          {status.count === 1 ? "name" : "names"} in the hat
        </p>
      </div>

      <div className="card">
        <h2>Everyone in?</h2>
        <p>
          This closes submissions. You&apos;ll read the names out one at a
          time — you can go through the list twice, then it disappears.
        </p>
        <button
          className="button"
          onClick={reveal}
          disabled={busy || status.count === 0}
        >
          {busy ? "One sec…" : "Close submissions & start reading"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </>
  );
}
