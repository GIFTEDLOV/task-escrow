"use client";

import { useState } from "react";
import { createWriteClient, CONTRACT_ADDRESS } from "@/lib/clients";

interface Props {
  onSuccess: () => void;
}

type Phase = "idle" | "wallet" | "pending";

function genToWei(value: string): bigint {
  const [whole, frac = ""] = value.trim().split(".");
  const fracPadded = frac.slice(0, 18).padEnd(18, "0");
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded || "0");
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

const inputStyle: React.CSSProperties = {
  background: "#f0efe9",
  border: "1px solid rgba(0,0,0,0.09)",
  borderRadius: 12,
  padding: "10px 16px",
  fontSize: 14,
  color: "#0a0a0a",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#9ca3af",
  marginBottom: 6,
  display: "block",
};

export default function PostTask({ onSuccess }: Props) {
  const [instruction, setInstruction] = useState("");
  const [reward, setReward] = useState("");
  const [deadline, setDeadline] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [backgroundProcessing, setBackgroundProcessing] = useState(false);

  const busy = phase !== "idle";
  const minDatetime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBackgroundProcessing(false);

    if (!instruction.trim()) { setError("Instruction is required."); return; }
    const rewardNum = parseFloat(reward);
    if (isNaN(rewardNum) || rewardNum < 1) { setError("Reward must be at least 1 GEN."); return; }
    if (!deadline) { setError("Deadline is required."); return; }
    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
    if (deadlineTs <= Math.floor(Date.now() / 1000)) { setError("Deadline must be in the future."); return; }

    const eth = (window as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }).ethereum;
    if (!eth) { setError("No wallet detected. Connect Rabby or MetaMask first."); return; }
    let accounts: string[];
    try {
      accounts = await eth.request({ method: "eth_accounts" });
    } catch {
      setError("Could not read wallet accounts. Connect your wallet first.");
      return;
    }
    if (!accounts || accounts.length === 0) { setError("Connect your wallet first."); return; }

    const address = accounts[0] as `0x${string}`;
    const rewardWei = genToWei(reward);
    let txSubmitted = false;
    setPhase("wallet");

    try {
      const wc = createWriteClient(address);
      const txHash = await wc.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "post_task",
        args: [instruction.trim(), BigInt(deadlineTs)],
        value: rewardWei,
      });

      txSubmitted = true;
      setPhase("pending");

      await wc.waitForTransactionReceipt({ hash: txHash, retries: 120, interval: 5000 });

      setInstruction("");
      setReward("");
      setDeadline("");
      setPhase("idle");
      onSuccess();
    } catch (err) {
      setPhase("idle");
      if (txSubmitted) {
        setBackgroundProcessing(true);
      } else {
        setError(errMsg(err));
      }
    }
  }

  return (
    <section style={{ width: "100%" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b6763", marginBottom: 16 }}>
        Post a Task
      </h2>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#ffffff",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 20,
          padding: "28px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
        }}
      >
        {/* Instruction */}
        <div>
          <label htmlFor="instruction" style={labelStyle}>Instruction</label>
          <textarea
            id="instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={busy}
            rows={4}
            placeholder="Describe the task clearly and specifically…"
            style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }}
          />
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6, lineHeight: 1.5 }}>
            Good tasks are specific and checkable.{" "}
            <em>&ldquo;Write a 100-word poem about the sun&rdquo;</em> not &ldquo;write something.&rdquo;
          </p>
        </div>

        {/* Reward */}
        <div>
          <label htmlFor="reward" style={labelStyle}>Reward</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              id="reward"
              type="number"
              min="1"
              step="any"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              disabled={busy}
              placeholder="1"
              style={{ ...inputStyle, width: 100 }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#6b6763" }}>GEN</span>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>minimum 1 GEN</span>
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label htmlFor="deadline" style={labelStyle}>Deadline</label>
          <input
            id="deadline"
            type="datetime-local"
            min={minDatetime}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={busy}
            style={{ ...inputStyle, width: "fit-content", colorScheme: "light" }}
          />
        </div>

        {/* Submit */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
          <button
            type="submit"
            disabled={busy}
            style={{
              alignSelf: "flex-start",
              background: busy ? "#d1d0cc" : "#0a0a0a",
              color: busy ? "#6b6763" : "#f5f4f1",
              borderRadius: 100,
              padding: "11px 28px",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: busy ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (busy) return;
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(10,10,10,0.18)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
            }}
          >
            {phase === "wallet" ? "Confirm in wallet…" : phase === "pending" ? "Transaction pending…" : <>Post Task <span style={{ fontSize: 13 }}>↗</span></>}
          </button>

          {phase === "pending" && (
            <p style={{ fontSize: 12, color: "#6b6763", maxWidth: 380, lineHeight: 1.6 }}>
              Waiting for on-chain finalization — Bradbury consensus can take several minutes.
            </p>
          )}
          {backgroundProcessing && (
            <p style={{ fontSize: 13, color: "#d97706", maxWidth: 380, lineHeight: 1.6 }}>
              Still processing on Bradbury — your task will appear when consensus finishes.
            </p>
          )}
          {error && (
            <p style={{ fontSize: 13, color: "#ef4444", maxWidth: 380 }}>{error}</p>
          )}
        </div>
      </form>
    </section>
  );
}
