import { describe, expect, it } from "vitest";
import { readSafe } from "./safe.ts";

describe("readSafe product constraint", () => {
  it("rejects non-mainnet when requireMainnet is true", async () => {
    const client = {
      getChainId: async () => 31337,
    };
    await expect(
      readSafe({
        rpcUrl: "http://127.0.0.1:8545",
        safeAddress: "0x1111111111111111111111111111111111111111",
        requireMainnet: true,
        client: client as never,
      }),
    ).rejects.toThrow(/chainId 1/);
  });
});
