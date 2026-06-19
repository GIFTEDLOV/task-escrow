"use client";

import { useEffect, useRef, useState } from "react";
import { createWriteClient, readClient, CONTRACT_ADDRESS, formatGEN } from "@/lib/clients";
import TaskCard, { S, type FullTask, type WritePhase, type WriteResult } from "./TaskCard";
import ClaimBanner from "./ClaimBanner";

interface Reputation {
  completed: number;
  failed: number;
}

type Tab = "posted" | "doing" | "completed";
const TABS: Tab[] = ["posted", "doing", "completed"];

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

export default function Profile() {
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [reputation, setReputation] = useState<Reputation | null>(null);
  const [myTasks, setMyTasks] = useState<FullTask[] | null>(null);
  const [tab, setTab] = useState<Tab>("posted");

  const writeLockRef = useRef(false);
  const [writeLock, setWriteLock] = useState(false);
  const [pendingState, setPendingState] = useState<{ taskId: number; phase: WritePhase } | null>(null);
  const [writeResults, setWriteResults] = useState<Record<number, WriteResult>>({});
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

    async function fetchProfile() {
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

    fetchRef.current = fetchProfile;
    fetchProfile();
    const id = setInterval(fetchProfile, 10_000);
    return () => { active = false; clearInterval(id); };
  }, [connectedAddress]);

  async function executeWrite(
    taskId: number,
    writeFn: (wc: ReturnType<typeof createWriteClient>) => Promise<unknown>,
    onConfirmed: () => void,
  ) {
    if (writeLockRef.current || !connectedAddress) return;

    writeLockRef.current = true;
    setWriteLock(true);
    setPendingState({ taskId, phase: "wallet" });
    setWriteResults((prev) => { const next = { ...prev }; delete next[taskId]; return next; });

    let txSubmitted = false;

    try {
      const wc = createWriteClient(connectedAddress as `0x${string}`);
      const txHash = await writeFn(wc);

      txSubmitted = true;
      setPendingState({ taskId, phase: "pending" });

      await wc.waitForTransactionReceipt({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hash: txHash as any,
        retries: 120,
        interval: 5000,
      });

      setPendingState(null);
      writeLockRef.current = false;
      setWriteLock(false);
      fetchRef.current?.();
      onConfirmed();
    } catch (err) {
      setPendingState(null);
      writeLockRef.current = false;
      setWriteLock(false);
      if (txSubmitted) {
        setWriteResults((prev) => ({ ...prev, [taskId]: { type: "background" } }));
        fetchRef.current?.();
      } else {
        setWriteResults((prev) => ({ ...prev, [taskId]: { type: "error", message: errMsg(err) } }));
      }
    }
  }

  if (!connectedAddress) return null;

  const me = connectedAddress.toLowerCase();
  const tasks = myTasks ?? [];

  const tabTasks: Record<Tab, FullTask[]> = {
    posted: tasks.filter((t) => t.funder.toLowerCase() === me).sort((a, b) => b.id - a.id),
    doing: tasks
      .filter((t) => t.worker.toLowerCase() === me && ([S.ACCEPTED, S.SUBMITTED, S.DISPUTED] as number[]).includes(t.status))
      .sort((a, b) => b.id - a.id),
    completed: tasks
      .filter((t) => ([S.COMPLETE, S.RESOLVED] as number[]).includes(t.status))
      .sort((a, b) => b.id - a.id),
  };

  const rep = reputation ?? { completed: 0, failed: 0 };
  const totalRep = rep.completed + rep.failed;
  const successPct = totalRep > 0 ? Math.round((rep.completed / totalRep) * 100) : null;

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 18,
    padding: "18px 22px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  };

  return (
    <section style={{ width: "100%" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b6763", marginBottom: 16 }}>
        My Profile
      </h2>

      {/* Wallet + Reputation — side-by-side on md+ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 12 }}>
        {/* Wallet card */}
        <div style={cardStyle}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 8 }}>
            Wallet
          </p>
          <p style={{ fontFamily: "monospace", fontSize: 12, color: "#0a0a0a", wordBreak: "break-all", lineHeight: 1.5 }}>
            {connectedAddress}
          </p>
          <p style={{ marginTop: 10, fontSize: 24, fontWeight: 800, color: "#0a0a0a", letterSpacing: "-0.02em" }}>
            {balance ?? "—"}
          </p>
        </div>

        {/* Reputation card */}
        <div style={cardStyle}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 8 }}>
            Reputation
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 20 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#16a34a", letterSpacing: "-0.02em" }}>
                {rep.completed}
                <span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af", marginLeft: 4 }}>completed</span>
              </span>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#dc2626", letterSpacing: "-0.02em" }}>
                {rep.failed}
                <span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af", marginLeft: 4 }}>failed</span>
              </span>
            </div>
            {successPct !== null ? (
              <p style={{ fontSize: 12, color: "#6b6763" }}>{successPct}% success rate</p>
            ) : (
              <p style={{ fontSize: 12, color: "#9ca3af" }}>No completed tasks yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Claim banner — shown when user has pending dispute winnings */}
      <div style={{ marginBottom: 16 }}>
        <ClaimBanner
          address={connectedAddress}
          onClaimed={() => fetchRef.current?.()}
        />
      </div>

      {/* Horizontal tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? "#0a0a0a" : "#9ca3af",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid #0a0a0a" : "2px solid transparent",
              cursor: "pointer",
              transition: "color 0.15s",
              marginBottom: "-1px",
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span style={{ marginLeft: 6, fontSize: 11, color: tab === t ? "#6b6763" : "#d1d0cc" }}>
              {tabTasks[t].length}
            </span>
          </button>
        ))}
      </div>

      {/* Task grid */}
      {tabTasks[tab].length === 0 ? (
        <div
          style={{
            ...cardStyle,
            padding: "40px 32px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 14, color: "#6b6763" }}>No tasks here yet.</p>
        </div>
      ) : (
        <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10, padding: 0, margin: 0 }}>
          {tabTasks[tab].map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              connectedAddress={connectedAddress}
              writeLock={writeLock}
              pendingPhase={pendingState?.taskId === task.id ? pendingState.phase : undefined}
              writeResult={writeResults[task.id]}
              onExecuteWrite={(writeFn, onConfirmed) => executeWrite(task.id, writeFn, onConfirmed)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
