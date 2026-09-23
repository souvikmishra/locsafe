import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { computeSafeHashes } from "./hashes.ts";
import {
  decodeShareLink,
  encodeShareLink,
  packageFromTx,
  parsePackage,
  serializePackage,
  validateImportedSignature,
  validatePackage,
} from "./package.ts";
import { adjustVInSignature } from "./signatures.ts";
import { ZERO_ADDRESS, type SafeTx } from "./types.ts";

const tx: SafeTx = {
  to: "0x111CEEee040739fD91D29C34C33E6B3E112F2177",
  value: 0n,
  data: "0x",
  operation: 0,
  safeTxGas: 0n,
  baseGas: 0n,
  gasPrice: 0n,
  gasToken: ZERO_ADDRESS,
  refundReceiver: ZERO_ADDRESS,
  nonce: 7n,
};

const safe = "0x2222222222222222222222222222222222222222" as const;

describe("SignedTxPackage", () => {
  it("round-trips through JSON", () => {
    const pkg = packageFromTx({
      safeAddress: safe,
      safeVersion: "1.4.1",
      tx,
    });
    const again = parsePackage(serializePackage(pkg));
    expect(again).toEqual(pkg);
  });

  it("rejects a package whose stored hashes do not match the transaction", async () => {
    const pkg = packageFromTx({
      safeAddress: safe,
      safeVersion: "1.4.1",
      tx,
    });
    pkg.hashes.safeTxHash =
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const owner = privateKeyToAccount(generatePrivateKey());
    const result = await validateImportedSignature({
      pkg,
      signature: {
        signer: owner.address,
        data: `0x${"11".repeat(65)}` as `0x${string}`,
        kind: "eoa",
      },
      currentOwners: [owner.address],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/hash/i);
    }
  });

  it("rejects a signature that belongs to a different transaction", async () => {
    const owner = privateKeyToAccount(generatePrivateKey());
    const pkg = packageFromTx({
      safeAddress: safe,
      safeVersion: "1.4.1",
      tx,
    });
    const other = computeSafeHashes({
      safeAddress: safe,
      chainId: 1,
      version: "1.4.1",
      tx: { ...tx, nonce: 99n },
    });
    const foreign = adjustVInSignature(await owner.sign({ hash: other.safeTxHash }));
    const result = await validateImportedSignature({
      pkg,
      signature: { signer: owner.address, data: foreign, kind: "eoa" },
      currentOwners: [owner.address],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a recovered signer who is not in the current owner set", async () => {
    const owner = privateKeyToAccount(generatePrivateKey());
    const stranger = privateKeyToAccount(generatePrivateKey());
    const pkg = packageFromTx({
      safeAddress: safe,
      safeVersion: "1.4.1",
      tx,
    });
    const signature = adjustVInSignature(
      await stranger.sign({ hash: pkg.hashes.safeTxHash }),
    );
    const result = await validateImportedSignature({
      pkg,
      signature: { signer: stranger.address, data: signature, kind: "eoa" },
      currentOwners: [owner.address],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/not a current owner/i);
    }
  });

  it("accepts an EOA owner signature over the package safeTxHash", async () => {
    const owner = privateKeyToAccount(generatePrivateKey());
    const pkg = packageFromTx({
      safeAddress: safe,
      safeVersion: "1.4.1",
      tx,
    });
    const signature = adjustVInSignature(
      await owner.sign({ hash: pkg.hashes.safeTxHash }),
    );
    const result = await validateImportedSignature({
      pkg,
      signature: { signer: owner.address, data: signature, kind: "eoa" },
      currentOwners: [owner.address],
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a package carrying two signatures from the same owner", async () => {
    const owner = privateKeyToAccount(generatePrivateKey());
    const unsigned = packageFromTx({ safeAddress: safe, safeVersion: "1.4.1", tx });
    const data = adjustVInSignature(await owner.sign({ hash: unsigned.hashes.safeTxHash }));
    const one = { signer: owner.address, data, kind: "eoa" as const };
    const pkg = { ...unsigned, signatures: [one] };
    expect(await validatePackage({ pkg, currentOwners: [owner.address] })).toEqual({ ok: true });
    const result = await validatePackage({
      pkg: { ...unsigned, signatures: [one, one] },
      currentOwners: [owner.address],
    });
    expect(result).toEqual({ ok: false, reason: `Duplicate signature from ${owner.address}` });
  });

  it("refuses share links larger than 8KB", () => {
    const pkg = packageFromTx({
      safeAddress: safe,
      safeVersion: "1.4.1",
      tx: { ...tx, data: `0x${"aa".repeat(9000)}` },
    });
    expect(() => encodeShareLink(pkg)).toThrow(/8KB/);
  });

  it("decodes share links inside full URLs and honours allowNonMainnet", () => {
    const pkg = packageFromTx({ safeAddress: safe, safeVersion: "1.4.1", tx, chainId: 31337 });
    const url = `https://example.ipfs.dweb.link/${encodeShareLink(pkg)}`;
    expect(() => decodeShareLink(url)).toThrow(/Mainnet/);
    expect(decodeShareLink(url, { allowNonMainnet: true }).hashes).toEqual(pkg.hashes);
  });

  it("refuses to decode oversized share links", () => {
    expect(() => decodeShareLink(`#/p/${"A".repeat(20_000)}`)).toThrow(/8KB/);
  });
});
