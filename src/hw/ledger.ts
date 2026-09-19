import { serializeTransaction, type Hex } from "viem";
import {
  DEFAULT_ETH_PATH,
  ledgerHashedMessagePayload,
  type HardwareSigner,
  type SignedEthereumTx,
} from "./types.ts";
import type { SafeHashes } from "../domain/types.ts";

function toHexSig(v: number, r: string, s: string): Hex {
  const vv = v < 27 ? v + 27 : v;
  return `0x${r.replace(/^0x/, "")}${s.replace(/^0x/, "")}${vv.toString(16).padStart(2, "0")}` as Hex;
}

export async function connectLedger(path = DEFAULT_ETH_PATH): Promise<HardwareSigner> {
  const { default: TransportWebHID } = await import("@ledgerhq/hw-transport-webhid");
  const { default: Eth } = await import("@ledgerhq/hw-app-eth");
  const transport = await TransportWebHID.create();
  const eth = new Eth(transport, { scrambleKey: "ETH" });
  return {
    kind: "ledger",
    getAddress: async (derivation = path) => {
      const { address } = await eth.getAddress(derivation);
      return address as `0x${string}`;
    },
    signSafeTx: async (hashes: SafeHashes, derivation = path) => {
      const payload = ledgerHashedMessagePayload(hashes);
      const result = await eth.signEIP712HashedMessage(
        derivation,
        payload.domainSeparatorHex,
        payload.hashStructHex,
      );
      return toHexSig(result.v, result.r, result.s);
    },
    signEthereumTx: async (tx, derivation = path): Promise<SignedEthereumTx> => {
      const unsigned = {
        chainId: tx.chainId,
        type: "eip1559" as const,
        nonce: tx.nonce,
        gas: tx.gas,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
        to: tx.to,
        data: tx.data,
        value: tx.value ?? 0n,
      };
      const serialized = serializeTransaction(unsigned);
      const signed = await eth.signTransaction(derivation, serialized.slice(2));
      const raw = serializeTransaction(unsigned, {
        v: BigInt(signed.v),
        r: `0x${signed.r.replace(/^0x/, "")}` as Hex,
        s: `0x${signed.s.replace(/^0x/, "")}` as Hex,
      });
      const from = await eth.getAddress(derivation);
      return { raw, from: from.address as `0x${string}` };
    },
  };
}
