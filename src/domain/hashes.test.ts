import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { concatHex, keccak256 } from "viem";
import { describe, expect, it } from "vitest";
import { computeSafeHashes } from "./hashes.ts";
import type { SafeTx, SafeVersion } from "./types.ts";

const golden = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../testdata/golden/arbitrum-addOwner.json"),
    "utf8",
  ),
) as {
  chainId: number;
  safeAddress: `0x${string}`;
  safeVersion: SafeVersion;
  transaction: {
    to: `0x${string}`;
    value: string;
    data: `0x${string}`;
    operation: 0 | 1;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken: `0x${string}`;
    refundReceiver: `0x${string}`;
    nonce: string;
  };
  hashes: {
    domainHash: `0x${string}`;
    messageHash: `0x${string}`;
    safeTxHash: `0x${string}`;
  };
};

function txFromGolden(): SafeTx {
  const t = golden.transaction;
  return {
    to: t.to,
    value: BigInt(t.value),
    data: t.data,
    operation: t.operation,
    safeTxGas: BigInt(t.safeTxGas),
    baseGas: BigInt(t.baseGas),
    gasPrice: BigInt(t.gasPrice),
    gasToken: t.gasToken,
    refundReceiver: t.refundReceiver,
    nonce: BigInt(t.nonce),
  };
}

describe("computeSafeHashes", () => {
  it("matches the pcaversaccio Arbitrum addOwnerWithThreshold vector", () => {
    const hashes = computeSafeHashes({
      safeAddress: golden.safeAddress,
      chainId: golden.chainId,
      version: golden.safeVersion,
      tx: txFromGolden(),
    });

    expect(hashes.domainHash.toLowerCase()).toBe(golden.hashes.domainHash.toLowerCase());
    expect(hashes.messageHash.toLowerCase()).toBe(golden.hashes.messageHash.toLowerCase());
    expect(hashes.safeTxHash.toLowerCase()).toBe(golden.hashes.safeTxHash.toLowerCase());
  });

  it("derives safeTxHash as keccak256(0x1901 || domainHash || messageHash)", () => {
    const hashes = computeSafeHashes({
      safeAddress: golden.safeAddress,
      chainId: golden.chainId,
      version: golden.safeVersion,
      tx: txFromGolden(),
    });
    const packed = keccak256(
      concatHex(["0x1901", hashes.domainHash, hashes.messageHash]),
    );
    expect(packed.toLowerCase()).toBe(hashes.safeTxHash.toLowerCase());
  });
});
