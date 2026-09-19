import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { concat, keccak256, recoverAddress, toHex } from "viem";
import { describe, expect, it } from "vitest";
import { computeSafeHashes } from "./hashes.ts";
import {
  adjustVInSignature,
  buildSignatureBytes,
  generatePreValidatedSignature,
  SafeSignature,
} from "./signatures.ts";
import { ZERO_ADDRESS } from "./types.ts";

const tx = {
  to: "0x111CEEee040739fD91D29C34C33E6B3E112F2177" as const,
  value: 0n,
  data: "0x" as const,
  operation: 0 as const,
  safeTxGas: 0n,
  baseGas: 0n,
  gasPrice: 0n,
  gasToken: ZERO_ADDRESS,
  refundReceiver: ZERO_ADDRESS,
  nonce: 1n,
};

describe("signatures", () => {
  it("sorts concatenated ECDSA signatures by signer address", async () => {
    const a = privateKeyToAccount(generatePrivateKey());
    const b = privateKeyToAccount(generatePrivateKey());
    const { safeTxHash } = computeSafeHashes({
      safeAddress: "0x111CEEee040739fD91D29C34C33E6B3E112F2177",
      chainId: 1,
      version: "1.4.1",
      tx,
    });
    const sigA = adjustVInSignature(await a.sign({ hash: safeTxHash }));
    const sigB = adjustVInSignature(await b.sign({ hash: safeTxHash }));
    const packed = buildSignatureBytes([
      new SafeSignature(a.address, sigA),
      new SafeSignature(b.address, sigB),
    ]);
    const [first, second] = [a.address, b.address].sort((x, y) =>
      x.toLowerCase().localeCompare(y.toLowerCase()),
    );
    const firstSig = first.toLowerCase() === a.address.toLowerCase() ? sigA : sigB;
    const secondSig = first.toLowerCase() === a.address.toLowerCase() ? sigB : sigA;
    expect(packed.toLowerCase()).toBe(
      concat([firstSig as `0x${string}`, secondSig as `0x${string}`]).toLowerCase(),
    );
    expect(first.toLowerCase() <= second.toLowerCase()).toBe(true);
  });

  it("encodes EIP-1271 signatures with static offset and dynamic tail", () => {
    const nested = "0x0000000000000000000000000000000000000002";
    const inner = `0x${"ab".repeat(65)}`;
    const packed = buildSignatureBytes([
      new SafeSignature(nested, inner, true),
    ]);
    expect(packed.slice(2).length / 2).toBe(65 + 32 + 65);
    expect(packed.slice(-2)).toBe("ab");
    expect(packed.slice(130, 132)).toBe("00");
  });

  it("adjusts v from 0/1 to 27/28", () => {
    const r = "11".repeat(32);
    const s = "22".repeat(32);
    expect(adjustVInSignature(`0x${r}${s}00`).endsWith("1b")).toBe(true);
    expect(adjustVInSignature(`0x${r}${s}01`).endsWith("1c")).toBe(true);
    expect(adjustVInSignature(`0x${r}${s}1b`).endsWith("1b")).toBe(true);
  });

  it("builds a prevalidated 0x01 signature for an owner", () => {
    const owner = "0x1111111111111111111111111111111111111111";
    const sig = generatePreValidatedSignature(owner);
    expect(sig.data.endsWith("01")).toBe(true);
    expect(sig.data.toLowerCase()).toContain(owner.slice(2).toLowerCase());
    expect(sig.data.length).toBe(132);
  });

  it("recovers an EOA signer from an EIP-712 hash signature", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const { safeTxHash } = computeSafeHashes({
      safeAddress: "0x111CEEee040739fD91D29C34C33E6B3E112F2177",
      chainId: 1,
      version: "1.4.1",
      tx,
    });
    const signature = adjustVInSignature(await account.sign({ hash: safeTxHash }));
    const recovered = await recoverAddress({ hash: safeTxHash, signature });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
    expect(keccak256(toHex("x")).startsWith("0x")).toBe(true);
  });
});
