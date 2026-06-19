"use client";

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export const CONTRACT_ADDRESS =
  "0xDe77A32bBCdACFEb50D15660BF1bAA5B69010B0f" as const;

// Read-only client — no wallet, points directly at Bradbury RPC.
// Safe to call server-side too (just HTTP).
export const readClient = createClient({ chain: testnetBradbury });

// Write client factory — call only after MetaMask has returned an address.
export function createWriteClient(address: `0x${string}`) {
  return createClient({
    chain: testnetBradbury,
    account: address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: (window as any).ethereum,
  });
}

export function formatGEN(wei: bigint): string {
  const whole = wei / BigInt("1000000000000000000");
  const remainder = wei % BigInt("1000000000000000000");
  const frac = (remainder * 10000n) / BigInt("1000000000000000000");
  return `${whole}.${frac.toString().padStart(4, "0")} GEN`;
}
