"use client";

import { useEffect, useRef, useState } from "react";
import { createWriteClient, readClient, CONTRACT_ADDRESS } from "@/lib/clients";
import TaskCard, { type FullTask, type WritePhase, type WriteResult } from "./TaskCard";

interface OpenTaskRaw {
  id: number;
  funder: string;
  instruction: string;
  reward: string;
  deadline: number;
  created_at: number;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

function openToFull(t: OpenTaskRaw): FullTask {
  return { ...t, worker: ZERO_ADDR, status: 0, submission: "", verdict_winner: 0, verdict_reasoning: "" };
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

interface Props {
  refreshTrigger?: number;
}

export default function TaskBoard({ refreshTrigger }: Props) {
  const [tasks, setTasks] = useState<FullTask[] | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);

  const writeLockRef = useRef(false);
  const [writeLock, setWriteLock] = useState(false);
  const [pendingState, setPendingState] = useState<{ taskId: number; phase: WritePhase } | null>(null);
  const [writeResults, setWriteResults] = useState<Record<number, WriteResult>>({});
  const fetchRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    async function initAddress() {
      try {
        const accounts = await window.ethereum!.request<string[]>({ method: "eth_accounts" });
        setConnectedAddress(accounts[0] ?? null);
      } catch { /* not yet connected */ }
    }
    initAddress();

    const handler = (accounts: unknown) => setConnectedAddress((accounts as string[])[0] ?? null);
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum?.removeListener("accountsChanged", handler);
  }, []);

  useEffect(() => {
    let active = true;
    const addr = connectedAddress;

    async function fetchTasks() {
      try {
        const openRaw = (await readClient.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_open_tasks",
          args: [],
        })) as unknown as OpenTaskRaw[];

        let myTasks: FullTask[] = [];
        if (addr) {
          myTasks = (await readClient.readContract({
            address: CONTRACT_ADDRESS,
            functionName: "get_my_tasks",
            args: [addr],
          })) as unknown as FullTask[];
        }

        if (!active) return;

        const map = new Map<number, FullTask>();
        for (const t of myTasks) map.set(t.id, t);
        for (const t of openRaw) { if (!map.has(t.id)) map.set(t.id, openToFull(t)); }

        const sorted = Array.from(map.values()).sort((a, b) => {
          const aT = a.status > 3 ? 1 : 0;
          const bT = b.status > 3 ? 1 : 0;
          if (aT !== bT) return aT - bT;
          return b.id - a.id;
        });

        setTasks(sorted);
      } catch { /* keep cached data */ }
    }

    fetchRef.current = fetchTasks;
    fetchTasks();
    const id = setInterval(fetchTasks, 10_000);
    return () => { active = false; clearInterval(id); };
  }, [connectedAddress]);

  useEffect(() => {
    if (refreshTrigger) fetchRef.current?.();
  }, [refreshTrigger]);

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

  const taskList = tasks ?? [];
  const activeCount = taskList.filter((t) => t.status <= 3).length;

  return (
    <section style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b6763" }}>
          {connectedAddress ? "Tasks" : "Open Tasks"}
        </h2>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          {tasks === null ? "Loading…" : connectedAddress ? `${activeCount} active` : `${taskList.length} available`}
        </span>
      </div>

      {taskList.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: 18,
            padding: "56px 32px",
            textAlign: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <p style={{ fontSize: 14, color: "#6b6763" }}>No open tasks yet.</p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Be the first to post a task.</p>
        </div>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 10, padding: 0, margin: 0 }}>
          {taskList.map((task) => (
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
