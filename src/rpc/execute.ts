import {
  encodeFunctionData,
  type Hex,
  type PublicClient,
  type TransactionSerializable,
} from "viem";
import { buildSignatureBytes } from "../domain/signatures.ts";
import { toSafeSignatures } from "../domain/package.ts";
import type { SafeTx, SignedTxPackage } from "../domain/types.ts";
import { SAFE_WRITE_ABI } from "./abi.ts";

export function encodeExecTransaction(
  tx: SafeTx,
  signatures: Hex,
): Hex {
  return encodeFunctionData({
    abi: SAFE_WRITE_ABI,
    functionName: "execTransaction",
    args: [
      tx.to,
      tx.value,
      tx.data,
      tx.operation,
      tx.safeTxGas,
      tx.baseGas,
      tx.gasPrice,
      tx.gasToken,
      tx.refundReceiver,
      signatures,
    ],
  });
}

export function encodeApproveHash(hash: Hex): Hex {
  return encodeFunctionData({
    abi: SAFE_WRITE_ABI,
    functionName: "approveHash",
    args: [hash],
  });
}

export function encodeOwnerChange(
  kind: "addOwnerWithThreshold" | "removeOwner" | "swapOwner" | "changeThreshold",
  params: {
    owner?: `0x${string}`;
    prevOwner?: `0x${string}`;
    oldOwner?: `0x${string}`;
    newOwner?: `0x${string}`;
    threshold?: bigint;
  },
): Hex {
  if (kind === "addOwnerWithThreshold") {
    return encodeFunctionData({
      abi: SAFE_WRITE_ABI,
      functionName: kind,
      args: [params.owner!, params.threshold!],
    });
  }
  if (kind === "removeOwner") {
    return encodeFunctionData({
      abi: SAFE_WRITE_ABI,
      functionName: kind,
      args: [params.prevOwner!, params.owner!, params.threshold!],
    });
  }
  if (kind === "swapOwner") {
    return encodeFunctionData({
      abi: SAFE_WRITE_ABI,
      functionName: kind,
      args: [params.prevOwner!, params.oldOwner!, params.newOwner!],
    });
  }
  return encodeFunctionData({
    abi: SAFE_WRITE_ABI,
    functionName: "changeThreshold",
    args: [params.threshold!],
  });
}

export const SENTINEL_OWNERS = "0x0000000000000000000000000000000000000001" as const;

/** Safe owners form a linked list; getOwners() order gives each owner's predecessor. */
export function prevOwnerOf(
  owners: readonly `0x${string}`[],
  owner: `0x${string}`,
): `0x${string}` {
  const index = owners.findIndex((o) => o.toLowerCase() === owner.toLowerCase());
  if (index === -1) {
    throw new Error(`${owner} is not an owner of this Safe`);
  }
  return index === 0 ? SENTINEL_OWNERS : owners[index - 1];
}

export function execDataFromPackage(pkg: SignedTxPackage): Hex {
  const tx = {
    to: pkg.transaction.to,
    value: BigInt(pkg.transaction.value),
    data: pkg.transaction.data,
    operation: pkg.transaction.operation,
    safeTxGas: BigInt(pkg.transaction.safeTxGas),
    baseGas: BigInt(pkg.transaction.baseGas),
    gasPrice: BigInt(pkg.transaction.gasPrice),
    gasToken: pkg.transaction.gasToken,
    refundReceiver: pkg.transaction.refundReceiver,
    nonce: BigInt(pkg.transaction.nonce),
  };
  return encodeExecTransaction(tx, buildSignatureBytes(toSafeSignatures(pkg)));
}

export async function estimateExecGas(args: {
  client: PublicClient;
  safeAddress: `0x${string}`;
  from: `0x${string}`;
  data: Hex;
}): Promise<bigint> {
  return args.client.estimateGas({
    account: args.from,
    to: args.safeAddress,
    data: args.data,
  });
}

export async function broadcastRawTransaction(args: {
  client: PublicClient;
  raw: Hex;
}): Promise<Hex> {
  return args.client.sendRawTransaction({ serializedTransaction: args.raw });
}

export function unsignedExecTx(args: {
  chainId: number;
  nonce: number;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  to: `0x${string}`;
  data: Hex;
}): TransactionSerializable {
  return {
    chainId: args.chainId,
    type: "eip1559",
    nonce: args.nonce,
    gas: args.gas,
    maxFeePerGas: args.maxFeePerGas,
    maxPriorityFeePerGas: args.maxPriorityFeePerGas,
    to: args.to,
    data: args.data,
    value: 0n,
  };
}
