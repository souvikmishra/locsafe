import type { SafeHashes } from "../domain/types.ts";
import {
  DEFAULT_ETH_PATH,
  type HardwareSigner,
  type SignedEthereumTx,
} from "./types.ts";

type TrezorConnectApi = {
  init: (opts: Record<string, unknown>) => Promise<void>;
  ethereumGetAddress: (opts: unknown) => Promise<{ success: boolean; payload: { address: string } }>;
  ethereumSignTypedData: (opts: unknown) => Promise<{
    success: boolean;
    payload: { signature: `0x${string}` };
  }>;
  ethereumSignTransaction: (opts: unknown) => Promise<{
    success: boolean;
    payload: { v: string; r: string; s: string };
  }>;
};

let initialized = false;

export function trezorInitOptions(connectSrc = "./trezor/"): Record<string, unknown> {
  return {
    lazyLoad: true,
    transports: ["WebUsbTransport"],
    popup: false,
    connectSrc,
    manifest: {
      email: "locsafe@localhost",
      appUrl: typeof window === "undefined" ? "https://localhost" : window.location.origin,
      appName: "locsafe",
    },
    coreMode: "auto",
  };
}

export async function connectTrezor(
  path = DEFAULT_ETH_PATH,
  api?: TrezorConnectApi,
): Promise<HardwareSigner> {
  const TrezorConnect =
    api ??
    ((await import("@trezor/connect")).default as unknown as TrezorConnectApi);
  if (!initialized) {
    await TrezorConnect.init(trezorInitOptions());
    initialized = true;
  }
  return {
    kind: "trezor",
    getAddress: async (derivation = path) => {
      const result = await TrezorConnect.ethereumGetAddress({
        path: derivation,
        showOnTrezor: true,
      });
      if (!result.success) {
        throw new Error("Trezor getAddress failed");
      }
      return result.payload.address as `0x${string}`;
    },
    signSafeTx: async (hashes: SafeHashes, derivation = path) => {
      const result = await TrezorConnect.ethereumSignTypedData({
        path: derivation,
        data: {
          types: {
            EIP712Domain: [
              { name: "chainId", type: "uint256" },
              { name: "verifyingContract", type: "address" },
            ],
            SafeTx: [
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "data", type: "bytes" },
              { name: "operation", type: "uint8" },
              { name: "safeTxGas", type: "uint256" },
              { name: "baseGas", type: "uint256" },
              { name: "gasPrice", type: "uint256" },
              { name: "gasToken", type: "address" },
              { name: "refundReceiver", type: "address" },
              { name: "nonce", type: "uint256" },
            ],
          },
          domain: {},
          primaryType: "SafeTx",
          message: {},
        },
        metamask_v4_compat: true,
        domain_separator_hash: hashes.domainHash,
        message_hash: hashes.messageHash,
      });
      if (!result.success) {
        throw new Error("Trezor EIP-712 sign failed");
      }
      return result.payload.signature;
    },
    signEthereumTx: async (tx, derivation = path): Promise<SignedEthereumTx> => {
      const result = await TrezorConnect.ethereumSignTransaction({
        path: derivation,
        transaction: {
          to: tx.to,
          value: `0x${(tx.value ?? 0n).toString(16)}`,
          data: tx.data,
          chainId: tx.chainId,
          nonce: `0x${tx.nonce.toString(16)}`,
          gasLimit: `0x${tx.gas.toString(16)}`,
          maxFeePerGas: `0x${tx.maxFeePerGas.toString(16)}`,
          maxPriorityFeePerGas: `0x${tx.maxPriorityFeePerGas.toString(16)}`,
        },
      });
      if (!result.success) {
        throw new Error("Trezor ethereumSignTransaction failed");
      }
      const from = await TrezorConnect.ethereumGetAddress({ path: derivation });
      const { serializeTransaction } = await import("viem");
      const raw = serializeTransaction(
        {
          chainId: tx.chainId,
          type: "eip1559",
          nonce: tx.nonce,
          gas: tx.gas,
          maxFeePerGas: tx.maxFeePerGas,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
          to: tx.to,
          data: tx.data,
          value: tx.value ?? 0n,
        },
        {
          v: BigInt(result.payload.v),
          r: result.payload.r as `0x${string}`,
          s: result.payload.s as `0x${string}`,
        },
      );
      return { raw, from: from.payload.address as `0x${string}` };
    },
  };
}
