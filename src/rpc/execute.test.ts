import { describe, expect, it } from "vitest";
import { prevOwnerOf, SENTINEL_OWNERS } from "./execute.ts";

const owners = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
] as const;

describe("prevOwnerOf", () => {
  it("returns the sentinel for the first owner and the predecessor otherwise", () => {
    expect(prevOwnerOf(owners, owners[0])).toBe(SENTINEL_OWNERS);
    expect(prevOwnerOf(owners, owners[2])).toBe(owners[1]);
    expect(prevOwnerOf(owners, owners[1].toUpperCase().replace("0X", "0x") as `0x${string}`)).toBe(owners[0]);
  });

  it("rejects non-owners", () => {
    expect(() => prevOwnerOf(owners, "0x4444444444444444444444444444444444444444")).toThrow(
      /not an owner/,
    );
  });
});
