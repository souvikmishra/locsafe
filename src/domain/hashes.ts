import { concatHex, encodeAbiParameters, keccak256 } from "viem";
import {
  DOMAIN_SEPARATOR_TYPEHASH,
  SAFE_TX_TYPEHASH,
  type SafeHashes,
  type SafeTx,
  type SafeVersion,
} from "./types.ts";

export function computeSafeHashes(args: {
  safeAddress: `0x${string}`;
  chainId: number;
  version: SafeVersion;
  tx: SafeTx;
}): SafeHashes {
  void args.version;
  const domainHash = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }, { type: "address" }],
      [DOMAIN_SEPARATOR_TYPEHASH, BigInt(args.chainId), args.safeAddress],
    ),
  );
  const dataHash = keccak256(args.tx.data);
  const messageHash = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "uint8" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
      ],
      [
        SAFE_TX_TYPEHASH,
        args.tx.to,
        args.tx.value,
        dataHash,
        args.tx.operation,
        args.tx.safeTxGas,
        args.tx.baseGas,
        args.tx.gasPrice,
        args.tx.gasToken,
        args.tx.refundReceiver,
        args.tx.nonce,
      ],
    ),
  );
  const safeTxHash = keccak256(concatHex(["0x1901", domainHash, messageHash]));
  return { domainHash, messageHash, safeTxHash };
}
