import {
  concatHex,
  getAddress,
  hashMessage,
  isAddress,
  recoverAddress,
  type Hex,
} from "viem";
import { computeSafeHashes } from "./hashes.ts";
import { SafeSignature } from "./signatures.ts";
import type {
  PackageSignature,
  SafeTx,
  SafeVersion,
  SignedTxPackage,
} from "./types.ts";

const MAX_SHARE_LINK_BYTES = 8 * 1024;

export function txFromPackage(pkg: SignedTxPackage): SafeTx {
  const t = pkg.transaction;
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

export function packageFromTx(args: {
  safeAddress: `0x${string}`;
  safeVersion: SafeVersion;
  tx: SafeTx;
  signatures?: PackageSignature[];
  chainId?: number;
}): SignedTxPackage {
  const chainId = args.chainId ?? 1;
  const hashes = computeSafeHashes({
    safeAddress: args.safeAddress,
    chainId,
    version: args.safeVersion,
    tx: args.tx,
  });
  return {
    format: "locsafe-tx",
    formatVersion: 1,
    chainId,
    safeAddress: getAddress(args.safeAddress),
    safeVersion: args.safeVersion,
    transaction: {
      to: getAddress(args.tx.to),
      value: args.tx.value.toString(),
      data: args.tx.data,
      operation: args.tx.operation,
      safeTxGas: args.tx.safeTxGas.toString(),
      baseGas: args.tx.baseGas.toString(),
      gasPrice: args.tx.gasPrice.toString(),
      gasToken: getAddress(args.tx.gasToken),
      refundReceiver: getAddress(args.tx.refundReceiver),
      nonce: args.tx.nonce.toString(),
    },
    hashes,
    signatures: args.signatures ?? [],
  };
}

export function serializePackage(pkg: SignedTxPackage): string {
  return JSON.stringify(pkg, null, 2);
}

export function parsePackage(
  raw: string,
  options?: { allowNonMainnet?: boolean },
): SignedTxPackage {
  const parsed = JSON.parse(raw) as SignedTxPackage;
  if (parsed.format !== "locsafe-tx" || parsed.formatVersion !== 1) {
    throw new Error("Unsupported locsafe package format");
  }
  if (parsed.chainId !== 1 && !options?.allowNonMainnet) {
    throw new Error("Only Ethereum Mainnet (chainId 1) packages are supported");
  }
  if (!isAddress(parsed.safeAddress)) {
    throw new Error("Invalid safe address");
  }
  return parsed;
}

export function assertPackageHashes(pkg: SignedTxPackage): void {
  const expected = computeSafeHashes({
    safeAddress: pkg.safeAddress,
    chainId: pkg.chainId,
    version: pkg.safeVersion,
    tx: txFromPackage(pkg),
  });
  const keys: (keyof typeof expected)[] = [
    "domainHash",
    "messageHash",
    "safeTxHash",
  ];
  for (const key of keys) {
    if (expected[key].toLowerCase() !== pkg.hashes[key].toLowerCase()) {
      throw new Error(`Package ${key} does not match recomputed hash`);
    }
  }
}

function signatureV(data: string): number {
  return parseInt(data.slice(-2), 16);
}

async function recoverEoa(
  safeTxHash: Hex,
  signature: PackageSignature,
): Promise<`0x${string}`> {
  const v = signatureV(signature.data);
  if (signature.kind === "eth_sign" || v === 31 || v === 32) {
    const ethHash = hashMessage({ raw: safeTxHash });
    const normalizedV = v >= 31 ? v - 4 : v;
    const normalized = (signature.data.slice(0, -2) +
      normalizedV.toString(16).padStart(2, "0")) as Hex;
    return recoverAddress({ hash: ethHash, signature: normalized });
  }
  return recoverAddress({ hash: safeTxHash, signature: signature.data as Hex });
}

export async function validateImportedSignature(args: {
  pkg: SignedTxPackage;
  signature: PackageSignature;
  currentOwners: `0x${string}`[];
  isValidSignature?: (
    signer: `0x${string}`,
    hash: Hex,
    data: Hex,
  ) => Promise<boolean>;
  isApprovedHash?: (
    signer: `0x${string}`,
    hash: Hex,
  ) => Promise<boolean>;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    assertPackageHashes(args.pkg);
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }

  const owners = new Set(args.currentOwners.map((o) => o.toLowerCase()));
  const hash = args.pkg.hashes.safeTxHash;

  if (args.signature.kind === "eip1271") {
    if (!owners.has(args.signature.signer.toLowerCase())) {
      return { ok: false, reason: "EIP-1271 signer is not a current owner" };
    }
    if (!args.isValidSignature) {
      return { ok: false, reason: "EIP-1271 validation requires an RPC check" };
    }
    const valid = await args.isValidSignature(
      args.signature.signer,
      hash,
      args.signature.data,
    );
    return valid
      ? { ok: true }
      : { ok: false, reason: "isValidSignature returned false" };
  }

  if (args.signature.kind === "approved_hash") {
    if (!owners.has(args.signature.signer.toLowerCase())) {
      return { ok: false, reason: "Approved-hash signer is not a current owner" };
    }
    if (!args.isApprovedHash) {
      return { ok: false, reason: "approvedHashes check requires an RPC" };
    }
    const approved = await args.isApprovedHash(args.signature.signer, hash);
    return approved
      ? { ok: true }
      : { ok: false, reason: "Hash is not approved on-chain for this owner" };
  }

  let recovered: `0x${string}`;
  try {
    recovered = await recoverEoa(hash, args.signature);
  } catch {
    return { ok: false, reason: "Could not recover signer from signature" };
  }
  if (recovered.toLowerCase() !== args.signature.signer.toLowerCase()) {
    return {
      ok: false,
      reason: "Recovered signer does not match claimed signer",
    };
  }
  if (!owners.has(recovered.toLowerCase())) {
    return { ok: false, reason: "Signer is not a current owner" };
  }
  return { ok: true };
}

export async function validatePackage(args: {
  pkg: SignedTxPackage;
  currentOwners: `0x${string}`[];
  isValidSignature?: (
    signer: `0x${string}`,
    hash: Hex,
    data: Hex,
  ) => Promise<boolean>;
  isApprovedHash?: (signer: `0x${string}`, hash: Hex) => Promise<boolean>;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    assertPackageHashes(args.pkg);
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
  for (const signature of args.pkg.signatures) {
    const result = await validateImportedSignature({
      pkg: args.pkg,
      signature,
      currentOwners: args.currentOwners,
      isValidSignature: args.isValidSignature,
      isApprovedHash: args.isApprovedHash,
    });
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}

export function encodeShareLink(pkg: SignedTxPackage): string {
  const json = JSON.stringify(pkg);
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > MAX_SHARE_LINK_BYTES) {
    throw new Error("Package exceeds 8KB; export a .locsafe.json file instead");
  }
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `#/p/${b64}`;
}

export function decodeShareLink(
  hash: string,
  options?: { allowNonMainnet?: boolean },
): SignedTxPackage {
  const match = hash.match(/#\/p\/([A-Za-z0-9_-]+)/);
  if (!match) {
    throw new Error("Not a locsafe share link");
  }
  const padded = match[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const json = atob(padded + pad);
  return parsePackage(json, options);
}

export function toSafeSignatures(pkg: SignedTxPackage): SafeSignature[] {
  return pkg.signatures.map((signature) => {
    if (signature.kind === "eip1271") {
      return new SafeSignature(signature.signer, signature.data, true);
    }
    return new SafeSignature(signature.signer, signature.data, false);
  });
}

export function concatHexOrEmpty(parts: Hex[]): Hex {
  return parts.length === 0 ? "0x" : concatHex(parts);
}

export { MAX_SHARE_LINK_BYTES };
