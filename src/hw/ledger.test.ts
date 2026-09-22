import { describe, expect, it } from "vitest";
import { ledgerHashedMessagePayload } from "./types.ts";

describe("Ledger payload", () => {
  it("passes domain and message hashes without 0x to signEIP712HashedMessage", () => {
    const hashes = {
      domainHash: "0x1111111111111111111111111111111111111111111111111111111111111111" as const,
      messageHash: "0x2222222222222222222222222222222222222222222222222222222222222222" as const,
      safeTxHash: "0x3333333333333333333333333333333333333333333333333333333333333333" as const,
    };
    const payload = ledgerHashedMessagePayload(hashes);
    expect(payload.method).toBe("signEIP712HashedMessage");
    expect(payload.domainSeparatorHex).toBe(hashes.domainHash.slice(2));
    expect(payload.hashStructHex).toBe(hashes.messageHash.slice(2));
  });
});
