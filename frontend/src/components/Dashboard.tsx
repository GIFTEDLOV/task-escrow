"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { readClient, CONTRACT_ADDRESS, formatGEN } from "@/lib/clients";
import { S, type FullTask } from "./TaskCard";
import ConnectButton from "./ConnectButton";
import ClaimBanner from "./ClaimBanner";

interface Reputation {
  completed: number;
  failed: number;
}

const STATUS_LABEL: Record<number, string> = {
  [S.OPEN]: "Open",
  [S.ACCEPTED]: "Accepted",
  [S.SUBMITTED]: "Submitted",
  [S.DISPUTED]: "Disputed",
  [S.COMPLETE]: "Complete",
  [S.RESOLVED]: "Resolved",
  [S.CANCELLED]: "Cancelled",
  [S.EXPIRED]: "Expired",
};

const STATUS_DOT: Record<number, string> = {
  [S.OPEN]:      "#16a34a",
  [S.ACCEPTED]:  "#2563eb",
  [S.SUBMITTED]: "#d97706",
  [S.DISPUTED]:  "#ea580c",
  [S.COMPLETE]:  "#16a34a",
  [S.RESOLVED]:  "#7c3aed",
  [S.CANCELLED]: "#9ca3af",
  [S.EXPIRED]:   "#9ca3af",
};

function truncate(s: string, n = 72) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function safeFormatGEN(reward: unknown): string {
  try {
    if (typeof reward === "bigint") return formatGEN(reward);
    if (typeof reward === "number") return formatGEN(BigInt(Math.floor(reward)));
    if (typeof reward === "string" && reward !== "") return formatGEN(BigInt(reward));
    return "— GEN";
  } catch { return "— GEN"; }
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(0,0,0,0.07)",
  borderRadius: 18,
  padding: "20px 22px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#9ca3af",
  margin: "0 0 6px",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color: "#0a0a0a",
  lineHeight: 1,
};

export default function Dashboard() {
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [reputation, setReputation] = useState<Reputation | null>(null);
  const [myTasks, setMyTasks] = useState<FullTask[] | null>(null);
  const fetchRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    async function initAddress() {
      try {
        const accounts = await window.ethereum!.request<string[]>({ method: "eth_accounts" });
        setConnectedAddress(accounts[0] ?? null);
      } catch { /* not connected */ }
    }
    initAddress();

    const handler = (accounts: unknown) => setConnectedAddress((accounts as string[])[0] ?? null);
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum?.removeListener("accountsChanged", handler);
  }, []);

  useEffect(() => {
    let active = true;
    const addr = connectedAddress;

    if (!addr) {
      setMyTasks(null);
      setReputation(null);
      setBalance(null);
      return;
    }

    async function fetchData() {
      const [tasksRes, repRes, balRes] = await Promise.allSettled([
        readClient.readContract({ address: CONTRACT_ADDRESS, functionName: "get_my_tasks", args: [addr] }),
        readClient.readContract({ address: CONTRACT_ADDRESS, functionName: "get_reputation", args: [addr] }),
        readClient.getBalance({ address: addr as `0x${string}` }),
      ]);

      if (!active) return;
      if (tasksRes.status === "fulfilled") setMyTasks(tasksRes.value as unknown as FullTask[]);
      if (repRes.status === "fulfilled") setReputation(repRes.value as unknown as Reputation);
      if (balRes.status === "fulfilled") setBalance(formatGEN(balRes.value as unknown as bigint));
    }

    fetchRef.current = fetchData;
    fetchData();
    const id = setInterval(fetchData, 10_000);
    return () => { active = false; clearInterval(id); };
  }, [connectedAddress]);

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!connectedAddress) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: "80px auto",
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 20,
        }}
      >
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "#0a0a0a", margin: 0 }}>
          Welcome to TaskEscrow
        </h2>
        <p style={{ fontSize: 15, color: "#6b6763", lineHeight: 1.6, margin: 0 }}>
          Connect your wallet to see your dashboard, or browse open tasks without connecting.
        </p>
        <ConnectButton />
        <Link
          href="/tasks"
          style={{
            fontSize: 13,
            color: "#6b6763",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#0a0a0a"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#6b6763"; }}
        >
          Browse open tasks →
        </Link>
      </div>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  const tasks = myTasks ?? [];
  const me = connectedAddress.toLowerCase();

  const postedCount = tasks.filter((t) => t.funder.toLowerCase() === me).length;
  const doingCount = tasks.filter(
    (t) =>
      t.worker.toLowerCase() === me &&
      ([S.ACCEPTED, S.SUBMITTED, S.DISPUTED] as number[]).includes(t.status),
  ).length;
  const completedCount = tasks.filter((t) =>
    ([S.COMPLETE, S.RESOLVED] as number[]).includes(t.status),
  ).length;

  const rep = reputation ?? { completed: 0, failed: 0 };
  const totalRep = rep.completed + rep.failed;
  const successPct = totalRep > 0 ? Math.round((rep.completed / totalRep) * 100) : null;

  const recent = [...tasks].sort((a, b) => b.id - a.id).slice(0, 6);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 80px" }}>
      {/* Page title */}
      <h1
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#6b6763",
          margin: "0 0 20px",
        }}
      >
        Dashboard
      </h1>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <div style={cardStyle}>
          <p style={statLabelStyle}>Balance</p>
          <p style={{ ...statValueStyle, fontSize: 20 }}>{balance ?? "—"}</p>
          <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 6, lineHeight: 1.4 }}>
            Payouts settle ~2–4 hrs after finalization on Bradbury
          </p>
        </div>
        <div style={cardStyle}>
          <p style={statLabelStyle}>Success Rate</p>
          <p style={statValueStyle}>
            {successPct !== null ? `${successPct}%` : "—"}
          </p>
          {totalRep > 0 && (
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              {rep.completed}/{totalRep} tasks
            </p>
          )}
        </div>
        <div style={cardStyle}>
          <p style={statLabelStyle}>Posted</p>
          <p style={statValueStyle}>{myTasks === null ? "—" : postedCount}</p>
        </div>
        <div style={cardStyle}>
          <p style={statLabelStyle}>Active</p>
          <p style={{ ...statValueStyle, color: doingCount > 0 ? "#2563eb" : "#0a0a0a" }}>
            {myTasks === null ? "—" : doingCount}
          </p>
          {doingCount > 0 && <p style={{ fontSize: 11, color: "#2563eb", marginTop: 4 }}>in progress</p>}
        </div>
        <div style={cardStyle}>
          <p style={statLabelStyle}>Completed</p>
          <p style={{ ...statValueStyle, color: completedCount > 0 ? "#16a34a" : "#0a0a0a" }}>
            {myTasks === null ? "—" : completedCount}
          </p>
        </div>
      </div>

      {/* Claim banner — shown when user has pending dispute winnings */}
      {connectedAddress && (
        <div style={{ marginBottom: 28 }}>
          <ClaimBanner
            address={connectedAddress}
            onClaimed={() => fetchRef.current?.()}
          />
        </div>
      )}

      {/* Recent activity */}
      <div style={{ marginBottom: 28 }}>
        <h2
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#6b6763",
            marginBottom: 14,
            margin: "0 0 14px",
          }}
        >
          Recent Activity
        </h2>

        {recent.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "32px 24px" }}>
            <p style={{ fontSize: 14, color: "#6b6763" }}>No activity yet.</p>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
              Post or accept a task to get started.
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.07)",
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            {recent.map((task, i) => {
              const role = task.funder.toLowerCase() === me ? "Posted" : "Working";
              const dotColor = STATUS_DOT[task.status] ?? "#9ca3af";
              return (
                <div
                  key={task.id}
                  style={{
                    padding: "12px 20px",
                    borderBottom: i < recent.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  {/* Top row: dot + status + role + reward */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: dotColor, flex: 1 }}>
                      {STATUS_LABEL[task.status] ?? "—"}
                    </span>
                    <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{role}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0a0a0a", flexShrink: 0, fontFamily: "monospace" }}>
                      {safeFormatGEN(task.reward)}
                    </span>
                  </div>
                  {/* Bottom row: instruction text */}
                  <p style={{ margin: 0, paddingLeft: 15, fontSize: 13, color: "#374151", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {task.instruction}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link
          href="/tasks"
          style={{
            background: "#0a0a0a",
            color: "#f5f4f1",
            borderRadius: 100,
            padding: "11px 24px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            transition: "transform 0.12s ease, box-shadow 0.12s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 14px rgba(10,10,10,0.18)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.transform = "";
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = "";
          }}
        >
          Browse Tasks <span style={{ fontSize: 12 }}>↗</span>
        </Link>
        <Link
          href="/profile"
          style={{
            background: "#f0efe9",
            color: "#0a0a0a",
            borderRadius: 100,
            padding: "11px 24px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            border: "1px solid rgba(0,0,0,0.08)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            transition: "transform 0.12s ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = ""; }}
        >
          My Profile →
        </Link>
      </div>
    </div>
  );
}
