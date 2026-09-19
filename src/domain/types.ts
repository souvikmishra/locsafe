export type SafeVersion = "1.3.0" | "1.4.1";

export interface SafeTx {
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
  operation: 0 | 1;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: `0x${string}`;
  refundReceiver: `0x${string}`;
  nonce: bigint;
}

export interface SafeHashes {
  domainHash: `0x${string}`;
  messageHash: `0x${string}`;
  safeTxHash: `0x${string}`;
}

export type SignatureKind = "eoa" | "eth_sign" | "approved_hash" | "eip1271";

export interface PackageSignature {
  signer: `0x${string}`;
  data: `0x${string}`;
  kind: SignatureKind;
}

export interface SignedTxPackage {
  format: "locsafe-tx";
  formatVersion: 1;
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
  hashes: SafeHashes;
  signatures: PackageSignature[];
}

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

export const DOMAIN_SEPARATOR_TYPEHASH =
  "0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218" as const;

export const SAFE_TX_TYPEHASH =
  "0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8" as const;

export const EIP1271_MAGIC_VALUE = "0x1626ba7e" as const;
