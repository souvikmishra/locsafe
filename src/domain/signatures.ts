import { getAddress } from "viem";

/**
 * A single owner signature over a SafeTx hash.
 * Byte-compatible with protocol-kit EthSafeSignature / buildSignatureBytes
 * (ported from Cyfrin/localsafe.eth, MIT).
 */
export class SafeSignature {
  signer: string;
  data: string;
  isContractSignature: boolean;

  constructor(signer: string, signature: string, isContractSignature = false) {
    this.signer = signer;
    this.data = signature;
    this.isContractSignature = isContractSignature;
  }

  staticPart(dynamicOffset?: string): string {
    if (this.isContractSignature) {
      return `000000000000000000000000${this.signer.slice(2)}${dynamicOffset ?? ""}00`;
    }
    return this.data.slice(2);
  }

  dynamicPart(): string {
    if (this.isContractSignature) {
      const dynamicPartLength = (this.data.slice(2).length / 2)
        .toString(16)
        .padStart(64, "0");
      return `${dynamicPartLength}${this.data.slice(2)}`;
    }
    return "";
  }
}

export function generatePreValidatedSignature(ownerAddress: string): SafeSignature {
  const checksummed = getAddress(ownerAddress);
  const signature = `0x000000000000000000000000${checksummed.slice(2)}${"0".repeat(64)}01`;
  return new SafeSignature(checksummed, signature);
}

export function buildSignatureBytes(signatures: SafeSignature[]): `0x${string}` {
  const SIGNATURE_LENGTH_BYTES = 65;
  const sorted = [...signatures].sort((a, b) =>
    a.signer.toLowerCase().localeCompare(b.signer.toLowerCase()),
  );

  let signatureBytes = "0x";
  let dynamicBytes = "";
  for (const signature of sorted) {
    if (signature.isContractSignature) {
      const dynamicPartPosition = (
        sorted.length * SIGNATURE_LENGTH_BYTES +
        dynamicBytes.length / 2
      )
        .toString(16)
        .padStart(64, "0");
      signatureBytes += signature.staticPart(dynamicPartPosition);
      dynamicBytes += signature.dynamicPart();
    } else {
      signatureBytes += signature.staticPart();
    }
  }
  return (signatureBytes + dynamicBytes) as `0x${string}`;
}

export function adjustVInSignature(signature: string): `0x${string}` {
  const ETHEREUM_V_VALUES = [0, 1, 27, 28];
  const MIN_VALID_V_VALUE_FOR_SAFE_ECDSA = 27;
  let signatureV = parseInt(signature.slice(-2), 16);
  if (!ETHEREUM_V_VALUES.includes(signatureV)) {
    throw new Error(`Invalid signature: unexpected v value ${signatureV}`);
  }
  if (signatureV < MIN_VALID_V_VALUE_FOR_SAFE_ECDSA) {
    signatureV += MIN_VALID_V_VALUE_FOR_SAFE_ECDSA;
  }
  return (signature.slice(0, -2) + signatureV.toString(16)) as `0x${string}`;
}

export function ethSignV(signature: `0x${string}`): `0x${string}` {
  const adjusted = adjustVInSignature(signature);
  const v = parseInt(adjusted.slice(-2), 16);
  const ethSign = v + 4;
  return (adjusted.slice(0, -2) + ethSign.toString(16)) as `0x${string}`;
}
