import { computeSafeHashes } from "../domain/hashes.ts";
import { decodeCalldata } from "../domain/decode.ts";
import type { SafeTx, SafeVersion } from "../domain/types.ts";
import { ZERO_ADDRESS } from "../domain/types.ts";
import { assertHashesMatchChain, createRpcClient } from "../rpc/safe.ts";

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function required(args: Args, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`Missing --${key}`);
  }
  return value;
}

function hex(value: string): `0x${string}` {
  return (value.startsWith("0x") ? value : `0x${value}`) as `0x${string}`;
}

export async function runCli(
  argv: string[],
  io: { log: (s: string) => void; err: (s: string) => void } = {
    log: console.log,
    err: console.error,
  },
): Promise<number> {
  try {
    const args = parseArgs(argv);
    if (args.help) {
      io.log(`locsafe-hash — compute Safe EIP-712 hashes locally

Usage:
  locsafe-hash --safe 0x... --chain-id 1 --version 1.4.1 \\
    --to 0x... --value 0 --data 0x --operation 0 --nonce N [--rpc URL]

Prints domain hash, message hash, safeTxHash, and decoded calldata.
If --rpc is set, also checks on-chain getTransactionHash.

Mainnet example (compare with pcaversaccio/safe-tx-hashes-util --interactive):
  locsafe-hash --safe 0x8FA3b4570B4C96f8036C13b64971BA65867eEB48 \\
    --chain-id 1 --version 1.3.0 --to 0x8FA3b4570B4C96f8036C13b64971BA65867eEB48 \\
    --value 0 --data 0x --operation 0 --nonce 39
`);
      return 0;
    }

    const chainId = Number(required(args, "chain-id"));
    const version = required(args, "version") as SafeVersion;
    if (version !== "1.3.0" && version !== "1.4.1") {
      throw new Error(" --version must be 1.3.0 or 1.4.1");
    }
    const tx: SafeTx = {
      to: hex(required(args, "to")),
      value: BigInt(String(args.value ?? "0")),
      data: hex(String(args.data ?? "0x")),
      operation: Number(args.operation ?? 0) as 0 | 1,
      safeTxGas: BigInt(String(args["safe-tx-gas"] ?? "0")),
      baseGas: BigInt(String(args["base-gas"] ?? "0")),
      gasPrice: BigInt(String(args["gas-price"] ?? "0")),
      gasToken: hex(String(args["gas-token"] ?? ZERO_ADDRESS)),
      refundReceiver: hex(String(args["refund-receiver"] ?? ZERO_ADDRESS)),
      nonce: BigInt(required(args, "nonce")),
    };
    const safe = hex(required(args, "safe"));
    const hashes = computeSafeHashes({
      safeAddress: safe,
      chainId,
      version,
      tx,
    });

    const decoded = decodeCalldata(tx.data);

    io.log(`Domain hash: ${hashes.domainHash}`);
    io.log(`Message hash: ${hashes.messageHash}`);
    io.log(`Safe transaction hash: ${hashes.safeTxHash}`);
    if (decoded.verified) {
      io.log(`Calldata: ${decoded.signature} ${JSON.stringify(decoded.args, (_k, v) => typeof v === "bigint" ? v.toString() : v)}`);
    } else {
      io.log(`Calldata: UNVERIFIED ${decoded.raw}`);
    }

    const rpc = args.rpc;
    if (typeof rpc === "string") {
      const client = createRpcClient(rpc);
      await assertHashesMatchChain({
        client,
        safeAddress: safe,
        version,
        chainId,
        tx,
      });
      io.log("On-chain getTransactionHash: match");
    }
    return 0;
  } catch (error) {
    io.err((error as Error).message);
    return 1;
  }
}

