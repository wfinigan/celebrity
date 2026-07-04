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
  locked?: boolean;
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
              locked: false,
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
          ? data.done
            ? { ...s, locked: true, currentName: null }
            : {
                ...s,
                served: data.served,
                total: data.total,
                currentName: data.name,
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
        <header>
          <p className="eyebrow">Game {code}</p>
          <h1>Not the host</h1>
        </header>
        <p className="lede">
          This device didn&apos;t start game {code}, so it can&apos;t read the
          list. If you&apos;re playing,{" "}
          <Link href={`/g/${code}`}>join here</Link>.
        </p>
        <p>
          <Link href="/">Back to the start</Link>
        </p>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <header>
          <p className="eyebrow">Game {code}</p>
          <h1>Nothing here</h1>
        </header>
        <p className="lede">
          This game doesn&apos;t exist or has expired.
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

  // ----- Reading phase: one name at a time, two passes max -----
  if (status.revealed && status.total) {
    const total = status.total;
    const served = status.served ?? 0;
    const maxPasses = status.maxPasses ?? 2;
    // Finished only when the reader has explicitly confirmed past the last
    // name — the last card stays on screen until then.
    const finished = !!status.locked;
    const pass = served === 0 ? 1 : Math.floor((served - 1) / total) + 1;
    const indexInPass = served === 0 ? 0 : ((served - 1) % total) + 1;
    const atEndOfPass = indexInPass === total;
    const onLastPass = pass === maxPasses;

    if (finished) {
      return (
        <>
          <header>
            <p className="eyebrow">Game {code}</p>
            <h1>The list is gone</h1>
          </header>
          <p className="lede">
            All {total} names were read {maxPasses} times, and there&apos;s no
            way to see them again. Go around the room and guess who said who.
          </p>
          <hr className="rule" />
          <p>
            <Link href="/">Start another game</Link>
          </p>
        </>
      );
    }

    if (served === 0) {
      return (
        <>
          <header>
            <p className="eyebrow">Game {code}</p>
            <h1>Ready to read?</h1>
          </header>
          <p className="lede">
            {total} {total === 1 ? "name is" : "names are"} in the hat.
            You&apos;ll see one at a time — never the whole list — and you can
            go through it {maxPasses} times before it&apos;s gone for good.
            You&apos;re playing too; no unfair advantage.
          </p>
          <div className="stack">
            <button className="button" onClick={nextName} disabled={busy}>
              Show the first name
            </button>
            <p className="hint">Make sure everyone is listening first.</p>
          </div>
          {error && <p className="error">{error}</p>}
        </>
      );
    }

    return (
      <>
        <p className="flash-meta">
          Name {indexInPass} of {total} · read-through {pass} of {maxPasses}
        </p>
        <div className="flashcard" key={served}>
          {status.currentName}
        </div>
        {atEndOfPass ? (
          <div className="stack">
            <p className="hint center">
              {onLastPass
                ? "End of the final read. Once you continue, the names are gone forever."
                : "End of the list. You can read it once more — after that it's gone."}
            </p>
            <button className="button" onClick={nextName} disabled={busy}>
              {onLastPass ? "Finish — lock the list" : "Read it again"}
            </button>
          </div>
        ) : (
          <button className="button" onClick={nextName} disabled={busy}>
            Next name
          </button>
        )}
        {error && <p className="error center">{error}</p>}
      </>
    );
  }

  // ----- Lobby phase: collect submissions -----
  return (
    <>
      <header>
        <p className="eyebrow">Your game code</p>
        <div className="code-badge">{code}</div>
      </header>

      <div className="stack">
        <p className="share-link">{joinUrl}</p>
        <button className="button button-secondary" onClick={copyLink}>
          {copied ? "Copied" : "Copy the join link"}
        </button>
      </div>

      <hr className="rule" />

      <div>
        <div className="count">{status.count}</div>
        <p className="count-label">
          {status.count === 1 ? "name" : "names"} in the hat
        </p>
      </div>

      <div className="stack">
        <button
          className="button"
          onClick={reveal}
          disabled={busy || status.count === 0}
        >
          {busy ? "One moment…" : "Close the hat & start reading"}
        </button>
        <p className="hint">
          Locks submissions. You&apos;ll read one name at a time, twice
          through at most — then the list disappears.
        </p>
        {error && <p className="error">{error}</p>}
      </div>
    </>
  );
}
