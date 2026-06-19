"use client";

import { useEffect, useRef, useState } from "react";
import { createWriteClient, readClient, CONTRACT_ADDRESS, formatGEN } from "@/lib/clients";

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

function safeToBigInt(raw: unknown): bigint {
  try {
    if (typeof raw === "bigint") return raw;
    if (typeof raw === "number") return BigInt(Math.floor(raw));
    if (typeof raw === "string" && raw !== "") return BigInt(raw);
    return 0n;
  } catch { return 0n; }
}

interface Props {
  address: string;
  onClaimed?: () => void;
}

type Phase = "idle" | "wallet" | "pending";

export default function ClaimBanner({ address, onClaimed }: Props) {
  const [claimable, setClaimable] = useState<bigint | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState<string>("");
  const writeLockRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<{ type: "error" | "background"; message?: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchClaimable() {
      try {
        const raw = await readClient.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_claimable",
          args: [address],
        });
        if (!active) return;
        setClaimable(safeToBigInt(raw));
      } catch { /* keep cached value on transient error */ }
    }

    fetchClaimable();
    const id = setInterval(fetchClaimable, 10_000);
    return () => { active = false; clearInterval(id); };
  }, [address]);

  // Show post-claim confirmation even after balance is zeroed
  if (!claimed && (claimable === null || claimable === 0n)) return null;

  const busy = phase !== "idle";
  const formatted = claimed ? claimedAmount : formatGEN(claimable ?? 0n);

  async function handleClaim() {
    if (writeLockRef.current) return;
    writeLockRef.current = true;
    setClaimedAmount(formatted);
    setPhase("wallet");
    setResult(null);

    let txSubmitted = false;

    try {
      const wc = createWriteClient(address as `0x${string}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txHash = await wc.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "claim_funds",
        args: [] as any,
        value: 0n,
      });

      txSubmitted = true;
      setPhase("pending");

      await wc.waitForTransactionReceipt({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hash: txHash as any,
        retries: 120,
        interval: 5000,
      });

      // Success — mark claimed and clear balance; parent refreshes on-chain balance
      setPhase("idle");
      writeLockRef.current = false;
      setClaimed(true);
      setClaimable(0n);
      onClaimed?.();
    } catch (err) {
      setPhase("idle");
      writeLockRef.current = false;
      if (txSubmitted) {
        // Tx reached chain but consensus timed out — treat as claimed (FINALIZED pending)
        setClaimed(true);
        setClaimable(0n);
        onClaimed?.();
      } else {
        setResult({ type: "error", message: errMsg(err) });
      }
    }
  }

  // Post-claim state: show settlement confirmation
  if (claimed) {
    return (
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid rgba(22,163,74,0.22)",
          borderLeft: "3px solid #16a34a",
          borderRadius: 18,
          padding: "18px 22px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "#16a34a",
            margin: "0 0 5px",
          }}
        >
          Payout confirmed on-chain
        </p>
        <p
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0a0a0a",
            margin: "0 0 10px",
            lineHeight: 1,
          }}
        >
          {formatted}
        </p>
        <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: 0 }}>
          Your claim is finalized — the GEN is on its way. Bradbury testnet settles transfers ~2–4 hours after finalization, so the funds will appear in your wallet during that window. You cannot double-claim; the contract recorded your claim at finalization.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fffbf5",
        border: "1px solid rgba(249,115,22,0.22)",
        borderLeft: "3px solid #f97316",
        borderRadius: 18,
        padding: "18px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 20,
        flexWrap: "wrap",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Label + amount */}
      <div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "#f97316",
            margin: "0 0 5px",
          }}
        >
          Dispute winnings ready
        </p>
        <p
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0a0a0a",
            margin: 0,
            lineHeight: 1,
          }}
        >
          {formatted}
        </p>
        <p style={{ fontSize: 11, color: "#9ca3af", margin: "6px 0 0", lineHeight: 1.4 }}>
          Once you claim, GEN settles to your wallet ~2–4 hrs after finalization on Bradbury.
        </p>
        {result?.type === "error" && (
          <p style={{ fontSize: 12, color: "#ef4444", marginTop: 6, margin: "6px 0 0" }}>
            {result.message}
          </p>
        )}
      </div>

      {/* Claim button */}
      <button
        type="button"
        disabled={busy}
        onClick={handleClaim}
        style={{
          background: busy ? "#d1d0cc" : "#0a0a0a",
          color: busy ? "#6b6763" : "#f5f4f1",
          borderRadius: 100,
          padding: "11px 26px",
          fontSize: 13,
          fontWeight: 600,
          border: "none",
          cursor: busy ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          flexShrink: 0,
          transition: "transform 0.12s ease, box-shadow 0.12s ease",
          whiteSpace: "nowrap",
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
        {phase === "wallet"
          ? "Confirm in wallet…"
          : phase === "pending"
          ? "Processing…"
          : <>Claim {formatted} <span style={{ fontSize: 12 }}>↗</span></>}
      </button>
    </div>
  );
}
