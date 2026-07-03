"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Status =
  | { active: false }
  | {
      active: true;
      gameId: number;
      count: number;
      revealed: boolean;
      isHost?: boolean;
      // Present for the host once revealed:
      total?: number;
      served?: number;
      currentName?: string | null;
      maxPasses?: number;
    };

const TOKEN_KEY = "celebrity-host-token";

export default function HostPage() {
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHostToken(localStorage.getItem(TOKEN_KEY));
    setTokenLoaded(true);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const url = hostToken
        ? `/api/game?hostToken=${encodeURIComponent(hostToken)}`
        : "/api/game";
      const res = await fetch(url);
      if (res.ok) setStatus(await res.json());
    } catch {
      // transient network error — next poll will retry
    }
  }, [hostToken]);

  const isReading = !!(
    status &&
    status.active &&
    status.revealed &&
    status.isHost
  );

  // Poll while waiting for submissions. Once reading starts, stop —
  // progress is driven by the "next" clicks.
  useEffect(() => {
    if (!tokenLoaded) return;
    refresh();
    if (isReading) return;
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [tokenLoaded, refresh, isReading]);

  async function startGame() {
    const inProgress = status?.active && !status.isHost;
    if (
      inProgress &&
      !window.confirm(
        "A game is already running on another device. Start a new one anyway? This throws away its names."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/game", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      localStorage.setItem(TOKEN_KEY, data.hostToken);
      setHostToken(data.hostToken);
      setStatus({
        active: true,
        gameId: Date.now(),
        count: 0,
        revealed: false,
        isHost: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    if (!hostToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/game/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setStatus((s) =>
        s && s.active
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
      const res = await fetch("/api/game/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setStatus((s) =>
        s && s.active
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

  if (!tokenLoaded || !status) {
    return <p className="center">Loading…</p>;
  }

  // ----- No game yet, or a game hosted by another device -----
  if (!status.active || !status.isHost) {
    return (
      <>
        <h1>Host a game 📣</h1>
        {status.active ? (
          <div className="card">
            <h2>A game is already running</h2>
            <p>
              It was started on another device ({status.count}{" "}
              {status.count === 1 ? "name" : "names"} in the hat so far). If
              that&apos;s stale or you want to take over, start a new game —
              its names will be thrown away.
            </p>
          </div>
        ) : (
          <p>
            Start a game, have everyone open this site and put a name in the
            hat, then read the list — one name at a time, twice through max.
          </p>
        )}
        <button className="button" onClick={startGame} disabled={busy}>
          {busy ? "Starting…" : "Start a new game"}
        </button>
        {error && <p className="error center">{error}</p>}
        <p className="center">
          <Link href="/">← Player page</Link>
        </p>
      </>
    );
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
          <div className="card center">
            <h2>The list is gone 🧠</h2>
            <p>
              All {total} names were read {maxPasses} times. No peeking — now
              go around the room and guess who said who!
            </p>
          </div>
          <button
            className="button button-secondary"
            onClick={startGame}
            disabled={busy}
          >
            Start a new game
          </button>
          {error && <p className="error center">{error}</p>}
        </>
      );
    }

    if (served === 0) {
      return (
        <div className="card center">
          <h2>Ready to read? 📣</h2>
          <p>
            {total} {total === 1 ? "name is" : "names are"} in the hat.
            You&apos;ll see one name at a time — never the whole list. You can
            go through it {maxPasses} times, then it&apos;s gone for good
            (you&apos;re playing too, no unfair advantage!).
          </p>
          <p>Make sure everyone is listening, then start.</p>
          <button className="button" onClick={nextName} disabled={busy}>
            Show the first name
          </button>
          {error && <p className="error">{error}</p>}
        </div>
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
      <h1>Hat is open 🎩</h1>
      <p>
        Tell everyone to open this site and put their names in. You can
        submit too — from the <Link href="/">player page</Link>.
      </p>

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

      <button
        className="button button-secondary"
        onClick={startGame}
        disabled={busy}
      >
        Restart (empty the hat)
      </button>
    </>
  );
}
