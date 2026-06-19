"use client";

import { useState, useRef } from "react";
import { createWriteClient, CONTRACT_ADDRESS, formatGEN } from "@/lib/clients";

export const S = {
  OPEN: 0,
  ACCEPTED: 1,
  SUBMITTED: 2,
  DISPUTED: 3,
  COMPLETE: 4,
  RESOLVED: 5,
  CANCELLED: 6,
  EXPIRED: 7,
} as const;

const STATUS_LABEL: Record<number, string> = {
  [S.OPEN]:      "Open",
  [S.ACCEPTED]:  "Accepted",
  [S.SUBMITTED]: "Submitted",
  [S.DISPUTED]:  "Disputed",
  [S.COMPLETE]:  "Complete",
  [S.RESOLVED]:  "Resolved",
  [S.CANCELLED]: "Cancelled",
  [S.EXPIRED]:   "Expired",
};

const STATUS_COLOR: Record<number, React.CSSProperties> = {
  [S.OPEN]:      { color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0" },
  [S.ACCEPTED]:  { color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe" },
  [S.SUBMITTED]: { color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a" },
  [S.DISPUTED]:  { color: "#ea580c", background: "#fff7ed", border: "1px solid #fed7aa" },
  [S.COMPLETE]:  { color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0" },
  [S.RESOLVED]:  { color: "#7c3aed", background: "#faf5ff", border: "1px solid #e9d5ff" },
  [S.CANCELLED]: { color: "#6b7280", background: "#f9fafb", border: "1px solid #e5e7eb" },
  [S.EXPIRED]:   { color: "#6b7280", background: "#f9fafb", border: "1px solid #e5e7eb" },
};

export interface FullTask {
  id: number;
  funder: string;
  worker: string;
  instruction: string;
  reward: string;
  deadline: number;
  status: number;
  submission: string;
  verdict_winner: number;
  verdict_reasoning: string;
  created_at: number;
}

export type WritePhase = "wallet" | "pending";
export interface WriteResult {
  type: "error" | "background";
  message?: string;
}

interface Props {
  task: FullTask;
  connectedAddress: string | null;
  writeLock: boolean;
  pendingPhase?: WritePhase;
  writeResult?: WriteResult;
  onExecuteWrite: (
    writeFn: (wc: ReturnType<typeof createWriteClient>) => Promise<unknown>,
    onConfirmed: () => void,
  ) => void;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

function safeFormatGEN(reward: unknown): string {
  try {
    if (typeof reward === "bigint") return formatGEN(reward);
    if (typeof reward === "number") return formatGEN(BigInt(Math.floor(reward)));
    if (typeof reward === "string" && reward !== "") return formatGEN(BigInt(reward));
    return "— GEN";
  } catch { return "— GEN"; }
}

function formatDeadline(ts: number): string {
  const diff = ts * 1000 - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days >= 2) return `in ${days} days`;
  if (days === 1) return "in 1 day";
  if (hours >= 2) return `in ${hours} hours`;
  if (hours === 1) return "in 1 hour";
  return "< 1 hour";
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface ABProps {
  label: string;
  variant: "primary" | "secondary" | "danger" | "ghost";
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({ label, variant, onClick, disabled }: ABProps) {
  const styles: Record<ABProps["variant"], React.CSSProperties> = {
    primary:   { background: "#0a0a0a", color: "#f5f4f1" },
    secondary: { background: "#f0efe9", color: "#0a0a0a", border: "1px solid rgba(0,0,0,0.08)" },
    danger:    { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" },
    ghost:     { background: "transparent", color: "#6b6763", border: "1px solid rgba(0,0,0,0.08)" },
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...styles[variant],
        borderRadius: 100,
        padding: "7px 18px",
        fontSize: 12,
        fontWeight: 600,
        border: styles[variant].border ?? "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "transform 0.12s ease, box-shadow 0.12s ease",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = variant === "primary"
          ? "0 3px 10px rgba(10,10,10,0.2)"
          : "0 2px 8px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
      }}
    >
      {label}
    </button>
  );
}

export default function TaskCard({
  task,
  connectedAddress,
  writeLock,
  pendingPhase,
  writeResult,
  onExecuteWrite,
}: Props) {
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submissionText, setSubmissionText] = useState("");
  const lastWriteIsPayoutRef = useRef(false);
  const [payoutDone, setPayoutDone] = useState(false);

  const me = connectedAddress?.toLowerCase();
  const isFunder = !!me && task.funder.toLowerCase() === me;
  const isWorker = !!me && task.worker.toLowerCase() === me && task.worker !== ZERO_ADDR;
  const isPastDeadline = task.deadline * 1000 < Date.now();
  const isThisPending = pendingPhase !== undefined;

  function write(fn: string, args: (bigint | string)[], onConfirmed = () => {}) {
    lastWriteIsPayoutRef.current = false;
    setPayoutDone(false);
    onExecuteWrite(
      (wc) => wc.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: fn,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: args as any,
        value: 0n,
      }),
      onConfirmed,
    );
  }

  function payoutWrite(fn: string, args: (bigint | string)[]) {
    lastWriteIsPayoutRef.current = true;
    setPayoutDone(false);
    onExecuteWrite(
      (wc) => wc.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: fn,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: args as any,
        value: 0n,
      }),
      () => setPayoutDone(true),
    );
  }

  const badgeStyle = STATUS_COLOR[task.status] ?? STATUS_COLOR[S.OPEN];

  return (
    <li
      style={{
        background: "#ffffff",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 18,
        padding: "20px 22px",
        listStyle: "none",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Instruction + badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <p style={{ fontSize: 14, color: "#0a0a0a", lineHeight: 1.6, flex: 1, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {task.instruction}
        </p>
        <span
          style={{
            ...badgeStyle,
            flexShrink: 0,
            borderRadius: 100,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {STATUS_LABEL[task.status] ?? "—"}
        </span>
      </div>

      {/* Meta */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px", marginTop: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0a0a0a" }}>
          {safeFormatGEN(task.reward)}
        </span>
        <span style={{ color: "#d1d0cc" }}>·</span>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>Deadline {formatDeadline(task.deadline)}</span>
        <span style={{ color: "#d1d0cc" }}>·</span>
        <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }} title={task.funder}>
          {truncate(task.funder)}
        </span>
        {task.worker !== ZERO_ADDR && (
          <>
            <span style={{ color: "#d1d0cc" }}>·</span>
            <span style={{ fontSize: 12, color: "#93c5fd", fontFamily: "monospace" }} title={task.worker}>
              worker {truncate(task.worker)}
            </span>
          </>
        )}
      </div>

      {/* Submission preview */}
      {(task.status === S.SUBMITTED || task.status === S.DISPUTED) && task.submission && (
        <div style={{ marginTop: 14, background: "#f9f8f6", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>Submitted work</p>
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {task.submission}
          </p>
        </div>
      )}

      {/* AI verdict */}
      {task.status === S.RESOLVED && (
        <div style={{ marginTop: 14, background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 12, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", marginBottom: 4 }}>
            AI Verdict — {task.verdict_winner === 1 ? "Worker wins ✓" : "Funder wins ✓"}
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{task.verdict_reasoning}</p>
        </div>
      )}

      {/* Action buttons */}
      {!isThisPending && (
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {task.status === S.OPEN && me && !isFunder && (
            <ActionButton label="Accept Task ↗" variant="primary" disabled={writeLock} onClick={() => write("accept_task", [BigInt(task.id)])} />
          )}
          {task.status === S.OPEN && isFunder && (
            <ActionButton label="Cancel" variant="danger" disabled={writeLock} onClick={() => payoutWrite("reclaim_unaccepted", [BigInt(task.id)])} />
          )}
          {task.status === S.ACCEPTED && isWorker && !showSubmitForm && (
            <ActionButton label="Submit Work ↗" variant="primary" disabled={writeLock} onClick={() => setShowSubmitForm(true)} />
          )}
          {task.status === S.ACCEPTED && isFunder && isPastDeadline && task.submission === "" && (
            <ActionButton label="Reclaim" variant="secondary" disabled={writeLock} onClick={() => payoutWrite("reclaim_expired", [BigInt(task.id)])} />
          )}
          {task.status === S.SUBMITTED && isFunder && (
            <>
              <ActionButton label="Accept Work ↗" variant="primary" disabled={writeLock} onClick={() => payoutWrite("accept_work", [BigInt(task.id)])} />
              <ActionButton label="Dispute" variant="danger" disabled={writeLock} onClick={() => write("dispute", [BigInt(task.id)])} />
            </>
          )}
          {task.status === S.DISPUTED && me && (
            <ActionButton label="Arbitrate (AI)" variant="secondary" disabled={writeLock} onClick={() => write("arbitrate", [BigInt(task.id)])} />
          )}
        </div>
      )}

      {/* Submit work inline form */}
      {task.status === S.ACCEPTED && isWorker && showSubmitForm && !isThisPending && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            value={submissionText}
            onChange={(e) => setSubmissionText(e.target.value)}
            rows={5}
            placeholder="Paste or write your completed work here…"
            style={{
              background: "#f0efe9",
              border: "1px solid rgba(0,0,0,0.09)",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 13,
              color: "#0a0a0a",
              fontFamily: "inherit",
              resize: "none",
              outline: "none",
              width: "100%",
              lineHeight: 1.6,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <ActionButton
              label="Submit ↗"
              variant="primary"
              disabled={writeLock || !submissionText.trim()}
              onClick={() =>
                write("submit_work", [BigInt(task.id), submissionText.trim()], () => {
                  setShowSubmitForm(false);
                  setSubmissionText("");
                })
              }
            />
            <ActionButton
              label="Cancel"
              variant="ghost"
              onClick={() => { setShowSubmitForm(false); setSubmissionText(""); }}
            />
          </div>
        </div>
      )}

      {/* Pending state */}
      {isThisPending && (
        <p style={{ marginTop: 14, fontSize: 12, color: "#6b6763", lineHeight: 1.5 }}>
          {pendingPhase === "wallet"
            ? "Confirm in wallet…"
            : lastWriteIsPayoutRef.current
            ? "Waiting for consensus — this may take a few minutes. Once finalized, GEN will settle in the recipient's wallet within ~2–4 hours."
            : "Transaction pending — Bradbury consensus can take several minutes."}
        </p>
      )}

      {/* Write result */}
      {writeResult?.type === "background" && (
        <p style={{ marginTop: 12, fontSize: 12, color: "#d97706", lineHeight: 1.5 }}>
          {lastWriteIsPayoutRef.current
            ? "Transaction is still processing toward finalization. Once confirmed on-chain, GEN will arrive in the recipient's wallet within ~2–4 hours (Bradbury testnet settlement cadence). This is normal."
            : "Still processing on Bradbury — will update when consensus finishes."}
        </p>
      )}
      {writeResult?.type === "error" && (
        <p style={{ marginTop: 12, fontSize: 12, color: "#ef4444" }}>{writeResult.message}</p>
      )}

      {/* Post-FINALIZED payout settlement notice */}
      {payoutDone && (
        <div
          style={{
            marginTop: 14,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderLeft: "3px solid #16a34a",
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", margin: "0 0 4px" }}>
            Payout confirmed on-chain
          </p>
          <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5, margin: 0 }}>
            Bradbury testnet settles transfers ~2–4 hours after finalization. The GEN will appear in the recipient&apos;s wallet during that window — this is normal testnet behaviour, not a delay in your payout.
          </p>
        </div>
      )}
    </li>
  );
}
