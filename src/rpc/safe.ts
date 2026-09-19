import {
  createPublicClient,
  getAddress,
  http,
  type Hex,
  type PublicClient,
} from "viem";
import { computeSafeHashes } from "../domain/hashes.ts";
import type { SafeTx, SafeVersion } from "../domain/types.ts";
import { EIP1271_MAGIC_VALUE } from "../domain/types.ts";
import { SAFE_FALLBACK_ABI, SAFE_READ_ABI } from "./abi.ts";

export type SafeSnapshot = {
  address: `0x${string}`;
  chainId: number;
  version: SafeVersion;
  owners: `0x${string}`[];
  threshold: number;
  nonce: bigint;
  balance: bigint;
};

export function createRpcClient(rpcUrl: string): PublicClient {
  return createPublicClient({
    transport: http(rpcUrl, { batch: false }),
  });
}

function parseVersion(raw: string): SafeVersion {
  if (raw.startsWith("1.4.1")) {
    return "1.4.1";
  }
  if (raw.startsWith("1.3.0")) {
    return "1.3.0";
  }
  throw new Error(
    `Unsupported Safe version ${raw}; locsafe supports v1.3.0 and v1.4.1`,
  );
}

export async function readSafe(args: {
  rpcUrl: string;
  safeAddress: `0x${string}`;
  requireMainnet?: boolean;
  client?: PublicClient;
}): Promise<SafeSnapshot> {
  const client = args.client ?? createRpcClient(args.rpcUrl);
  const chainId = await client.getChainId();
  if ((args.requireMainnet ?? true) && chainId !== 1) {
    throw new Error(`Expected Ethereum Mainnet (chainId 1), got ${chainId}`);
  }
  const address = getAddress(args.safeAddress);
  const code = await client.getCode({ address });
  if (!code || code === "0x") {
    throw new Error(`No contract at ${address}`);
  }

  const [versionRaw, owners, threshold, nonce, balance] = await Promise.all([
    client.readContract({ address, abi: SAFE_READ_ABI, functionName: "VERSION" }),
    client.readContract({ address, abi: SAFE_READ_ABI, functionName: "getOwners" }),
    client.readContract({
      address,
      abi: SAFE_READ_ABI,
      functionName: "getThreshold",
    }),
    client.readContract({ address, abi: SAFE_READ_ABI, functionName: "nonce" }),
    client.getBalance({ address }),
  ]);

  return {
    address,
    chainId,
    version: parseVersion(versionRaw),
    owners: [...owners],
    threshold: Number(threshold),
    nonce,
    balance,
  };
}

export async function onChainTransactionHash(args: {
  client: PublicClient;
  safeAddress: `0x${string}`;
  tx: SafeTx;
}): Promise<Hex> {
  return args.client.readContract({
    address: args.safeAddress,
    abi: SAFE_READ_ABI,
    functionName: "getTransactionHash",
    args: [
      args.tx.to,
      args.tx.value,
      args.tx.data,
      args.tx.operation,
      args.tx.safeTxGas,
      args.tx.baseGas,
      args.tx.gasPrice,
      args.tx.gasToken,
      args.tx.refundReceiver,
      args.tx.nonce,
    ],
  });
}

export async function assertHashesMatchChain(args: {
  client: PublicClient;
  safeAddress: `0x${string}`;
  version: SafeVersion;
  chainId: number;
  tx: SafeTx;
}): Promise<Hex> {
  const local = computeSafeHashes({
    safeAddress: args.safeAddress,
    chainId: args.chainId,
    version: args.version,
    tx: args.tx,
  });
  const onChain = await onChainTransactionHash(args);
  if (onChain.toLowerCase() !== local.safeTxHash.toLowerCase()) {
    throw new Error(
      `Local safeTxHash ${local.safeTxHash} does not match on-chain getTransactionHash ${onChain}`,
    );
  }
  return onChain;
}

export async function isApprovedHash(args: {
  client: PublicClient;
  safeAddress: `0x${string}`;
  owner: `0x${string}`;
  hash: Hex;
}): Promise<boolean> {
  const value = await args.client.readContract({
    address: args.safeAddress,
    abi: SAFE_READ_ABI,
    functionName: "approvedHashes",
    args: [args.owner, args.hash],
  });
  return value !== 0n;
}

export async function isValidEip1271Signature(args: {
  client: PublicClient;
  signer: `0x${string}`;
  hash: Hex;
  signature: Hex;
}): Promise<boolean> {
  const magic = await args.client.readContract({
    address: args.signer,
    abi: SAFE_FALLBACK_ABI,
    functionName: "isValidSignature",
    args: [args.hash, args.signature],
  });
  return magic.toLowerCase() === EIP1271_MAGIC_VALUE.toLowerCase();
}
