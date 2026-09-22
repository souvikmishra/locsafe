import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import { decodeCalldata, type SelectorDatabase } from "./decode.ts";

const selectors = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../public/4byte.json"),
    "utf8",
  ),
) as SelectorDatabase;

describe("decodeCalldata", () => {
  it("decodes addOwnerWithThreshold from the bundled selector database", () => {
    const data =
      "0x0d582f130000000000000000000000000c75fa5a5f1c0997e3eea425cfa13184ed0ec9e50000000000000000000000000000000000000000000000000000000000000003" as const;
    const result = decodeCalldata(data, { selectors });
    expect(result.verified).toBe(true);
    if (result.verified) {
      expect(result.signature).toBe("addOwnerWithThreshold(address,uint256)");
      expect(result.args[1]).toBe(3n);
    }
  });

  it("labels unknown calldata UNVERIFIED", () => {
    const result = decodeCalldata("0xdeadbeef", { selectors });
    expect(result).toEqual({
      verified: false,
      raw: "0xdeadbeef",
      label: "UNVERIFIED",
    });
  });

  it("keeps bundled selectors aligned with keccak", () => {
    for (const [selector, signature] of Object.entries(selectors)) {
      expect(toFunctionSelector(signature).toLowerCase()).toBe(selector);
    }
  });
});
