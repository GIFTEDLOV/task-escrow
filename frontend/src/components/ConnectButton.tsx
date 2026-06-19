"use client";

import { useState, useRef, useEffect } from "react";
import { readClient, createWriteClient, formatGEN } from "@/lib/clients";

const BRADBURY_CHAIN = {
  chainId: "0x107d",
  chainName: "Genlayer Bradbury Testnet",
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  blockExplorerUrls: ["https://explorer-bradbury.genlayer.com/"],
} as const;

type WalletState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; address: string; balance: string }
  | { status: "error"; message: string };

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface Props {
  compact?: boolean;
}

export default function ConnectButton({ compact = false }: Props) {
  const [wallet, setWallet] = useState<WalletState>({ status: "disconnected" });
  const writeClientRef = useRef<ReturnType<typeof createWriteClient> | null>(null);

  // Restore connected state on mount if wallet was previously authorized.
  // eth_accounts returns silently (no popup) — empty array means not connected.
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    async function detectExisting() {
      try {
        const accounts = await window.ethereum!.request<string[]>({ method: "eth_accounts" });
        if (!accounts || accounts.length === 0) return;
        const address = accounts[0] as `0x${string}`;
        let balance = "— GEN";
        try {
          const wei = await readClient.getBalance({ address });
          balance = formatGEN(wei);
        } catch { /* balance is non-critical */ }
        setWallet({ status: "connected", address, balance });
      } catch { /* wallet not available */ }
    }
    detectExisting();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length === 0) {
        setWallet({ status: "disconnected" });
        writeClientRef.current = null;
      } else if (wallet.status === "connected") {
        handleConnect();
      }
    };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum?.removeListener("accountsChanged", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.status]);

  async function handleConnect() {
    if (!window.ethereum) {
      setWallet({ status: "error", message: "No wallet detected. Install Rabby or MetaMask." });
      return;
    }
    setWallet({ status: "connecting" });
    try {
      const accounts = await window.ethereum.request<string[]>({ method: "eth_requestAccounts" });
      const address = accounts[0] as `0x${string}`;

      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [BRADBURY_CHAIN] });
      const currentChainId = await window.ethereum.request<string>({ method: "eth_chainId" });
      if (currentChainId !== BRADBURY_CHAIN.chainId) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BRADBURY_CHAIN.chainId }],
        });
      }

      const wc = createWriteClient(address);
      writeClientRef.current = wc;

      let balance = "— GEN";
      try {
        const wei = await readClient.getBalance({ address });
        balance = formatGEN(wei);
      } catch { /* non-critical */ }

      setWallet({ status: "connected", address, balance });
    } catch (err) {
      setWallet({ status: "error", message: errMsg(err) });
    }
  }

  function handleDisconnect() {
    writeClientRef.current = null;
    setWallet({ status: "disconnected" });
  }

  // ── Compact mode (nav bar) ─────────────────────────────────────────────────
  if (compact) {
    if (wallet.status === "connected") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              background: "#0a0a0a",
              color: "#f5f4f1",
              borderRadius: 100,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "#4ade80", fontSize: 8 }}>●</span>
            {truncate(wallet.address)}
          </div>
          <button
            onClick={handleDisconnect}
            title="Disconnect"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#9ca3af",
              fontSize: 15,
              lineHeight: 1,
              padding: "2px 4px",
              borderRadius: 4,
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#0a0a0a"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; }}
          >
            ×
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={handleConnect}
        disabled={wallet.status === "connecting"}
        style={{
          background: wallet.status === "connecting" ? "#d1d0cc" : "#0a0a0a",
          color: wallet.status === "connecting" ? "#6b6763" : "#f5f4f1",
          borderRadius: 100,
          padding: "6px 16px",
          fontSize: 13,
          fontWeight: 600,
          border: "none",
          cursor: wallet.status === "connecting" ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          transition: "transform 0.12s ease, box-shadow 0.12s ease",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (wallet.status === "connecting") return;
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(10,10,10,0.18)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
        }}
      >
        {wallet.status === "connecting" ? "Connecting…" : <>Connect <span style={{ fontSize: 11 }}>↗</span></>}
      </button>
    );
  }

  // ── Full mode (hero / page) ────────────────────────────────────────────────
  if (wallet.status === "connected") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: 16,
            padding: "16px 24px",
            textAlign: "center",
            minWidth: 300,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#6b6763", textTransform: "uppercase", marginBottom: 8, margin: 0, paddingBottom: 8 }}>
            Connected · Bradbury
          </p>
          <p style={{ fontFamily: "monospace", fontSize: 13, color: "#0a0a0a", wordBreak: "break-all", margin: 0 }}>
            {wallet.address}
          </p>
          <p style={{ marginTop: 10, fontSize: 22, fontWeight: 700, color: "#0a0a0a", margin: "10px 0 0" }}>
            {wallet.balance}
          </p>
        </div>
        <button
          onClick={handleDisconnect}
          style={{ fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6b6763"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <button
        onClick={handleConnect}
        disabled={wallet.status === "connecting"}
        style={{
          background: wallet.status === "connecting" ? "#d1d0cc" : "#0a0a0a",
          color: wallet.status === "connecting" ? "#6b6763" : "#f5f4f1",
          borderRadius: 100,
          padding: "13px 32px",
          fontSize: 14,
          fontWeight: 600,
          border: "none",
          cursor: wallet.status === "connecting" ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (wallet.status === "connecting") return;
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px) scale(1.02)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(10,10,10,0.2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
        }}
      >
        {wallet.status === "connecting" ? "Connecting…" : <>Connect Wallet <span style={{ fontSize: 13 }}>↗</span></>}
      </button>
      {wallet.status === "error" && (
        <p style={{ fontSize: 13, color: "#ef4444", maxWidth: 320, textAlign: "center" }}>
          {wallet.message}
        </p>
      )}
    </div>
  );
}
