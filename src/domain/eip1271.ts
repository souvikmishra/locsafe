import { buildSignatureBytes, SafeSignature } from "./signatures.ts";

export function packNestedSafeSignature(args: {
  nestedSafe: `0x${string}`;
  nestedOwnerSignatures: SafeSignature[];
}): SafeSignature {
  const packed = buildSignatureBytes(args.nestedOwnerSignatures);
  return new SafeSignature(args.nestedSafe, packed, true);
}
