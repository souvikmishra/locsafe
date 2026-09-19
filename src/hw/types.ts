import type { Hex } from "viem";
import type { SafeHashes } from "../domain/types.ts";

export type HardwareKind = "ledger" | "trezor";

export type SignedEthereumTx = {
  raw: Hex;
  from: `0x${string}`;
};

export type HardwareSigner = {
  kind: HardwareKind;
  getAddress: (path?: string) => Promise<`0x${string}`>;
  signSafeTx: (hashes: SafeHashes, path?: string) => Promise<Hex>;
  signEthereumTx: (
    tx: {
      chainId: number;
      nonce: number;
      gas: bigint;
      maxFeePerGas: bigint;
      maxPriorityFeePerGas: bigint;
      to: `0x${string}`;
      data: Hex;
      value?: bigint;
    },
    path?: string,
  ) => Promise<SignedEthereumTx>;
};

export const DEFAULT_ETH_PATH = "m/44'/60'/0'/0/0";

export function ledgerHashedMessagePayload(hashes: SafeHashes): {
  method: "signEIP712HashedMessage";
  domainSeparatorHex: string;
  hashStructHex: string;
} {
  return {
    method: "signEIP712HashedMessage",
    domainSeparatorHex: hashes.domainHash.slice(2),
    hashStructHex: hashes.messageHash.slice(2),
  };
}

export function assertNoVendorFetch(url: string): void {
  const blocked = ["ledger.com", "api.ledger.com", "nft.cdn.live", "trezor.io", "connect.trezor.io"];
  const host = new URL(url).hostname;
  if (blocked.some((b) => host === b || host.endsWith(`.${b}`))) {
    throw new Error(`Hardware wallet vendor fetch blocked: ${host}`);
  }
}

declare global {
  interface Window {
    __LOCSAFE_E2E_HW__?: HardwareSigner;
  }
}

export function e2eHardwareSigner(): HardwareSigner | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.__LOCSAFE_E2E_HW__ ?? null;
}
