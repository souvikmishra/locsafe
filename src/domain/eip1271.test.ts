import { describe, expect, it } from "vitest";
import { packNestedSafeSignature } from "./eip1271.ts";
import { buildSignatureBytes, SafeSignature } from "./signatures.ts";

describe("packNestedSafeSignature", () => {
  it("wraps nested owner signatures as an EIP-1271 contract signature", () => {
    const nested = "0x00000000000000000000000000000000000000aa" as const;
    const ownerSig = new SafeSignature(
      "0x00000000000000000000000000000000000000bb",
      `0x${"11".repeat(65)}`,
    );
    const wrapped = packNestedSafeSignature({
      nestedSafe: nested,
      nestedOwnerSignatures: [ownerSig],
    });
    expect(wrapped.isContractSignature).toBe(true);
    expect(wrapped.signer.toLowerCase()).toBe(nested.toLowerCase());
    expect(wrapped.data).toBe(buildSignatureBytes([ownerSig]));
  });
});
