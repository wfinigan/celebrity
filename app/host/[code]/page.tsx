"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

type Status = {
  count: number;
  revealed: boolean;
  isHost?: boolean;
  names?: string[];
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
  const [revealing, setRevealing] = useState(false);
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

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function reveal() {
    if (!hostToken) return;
    if (status && status.count === 0) {
      setError("No names submitted yet.");
      return;
    }
    setRevealing(true);
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
        s ? { ...s, revealed: true, names: data.names } : s
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRevealing(false);
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
          can&apos;t see the host view. If you&apos;re a player,{" "}
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

  if (status.revealed && status.names) {
    return (
      <>
        <div className="code-badge">{code}</div>
        <div>
          <h2 className="center">
            Read these aloud — once or twice, then it&apos;s memory time 🧠
          </h2>
        </div>
        <ol className="name-list">
          {status.names.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ol>
        <p className="center">
          Submissions are closed. When you&apos;re done reading, put the phone
          down and start guessing!
        </p>
        <p className="center">
          <Link href="/">Start another game</Link>
        </p>
      </>
    );
  }

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
          This closes submissions and shows you the shuffled list to read
          aloud.
        </p>
        <button
          className="button"
          onClick={reveal}
          disabled={revealing || status.count === 0}
        >
          {revealing ? "Revealing…" : "Close submissions & reveal"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </>
  );
}
