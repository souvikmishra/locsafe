import { describe, expect, it } from "vitest";
import type { SafeSnapshot } from "../rpc/safe.ts";
import { buildSafeTx } from "./build-tx.ts";

const [a, b, c] = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
] as const;
const safe = "0x9999999999999999999999999999999999999999" as const;

const snapshot = (owners: `0x${string}`[]): SafeSnapshot => ({
  address: safe,
  chainId: 1,
  version: "1.4.1",
  owners,
  threshold: 1,
  nonce: 5n,
  balance: 0n,
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("buildSafeTx", () => {
  it("builds an ETH transfer at the Safe's nonce", () => {
    const tx = buildSafeTx(form({ kind: "eth", to: b, value: "7" }), snapshot([a]));
    expect(tx).toMatchObject({ to: b, value: 7n, data: "0x", operation: 0, nonce: 5n });
  });

  it("builds valid owner changes against the Safe itself", () => {
    const owners = snapshot([a, b]);
    expect(buildSafeTx(form({ kind: "addOwner", owner: c, threshold: "3" }), owners).to).toBe(safe);
    expect(buildSafeTx(form({ kind: "removeOwner", owner: b, threshold: "1" }), owners).data).toMatch(/^0xf8dc5dd9/);
    expect(buildSafeTx(form({ kind: "swapOwner", oldOwner: a, newOwner: c }), owners).data).toMatch(/^0xe318b52b/);
  });

  it("rejects owner changes the Safe would revert", () => {
    const one = snapshot([a]);
    const two = snapshot([a, b]);
    const cases: [Record<string, string>, SafeSnapshot, RegExp][] = [
      [{ kind: "removeOwner", owner: a, threshold: "1" }, one, /at least one owner/],
      [{ kind: "removeOwner", owner: b, threshold: "2" }, two, /between 1 and 1/],
      [{ kind: "removeOwner", owner: c, threshold: "1" }, two, /not an owner/],
      [{ kind: "addOwner", owner: b, threshold: "1" }, two, /already an owner/],
      [{ kind: "addOwner", owner: safe, threshold: "1" }, two, /Safe itself/],
      [{ kind: "addOwner", owner: c, threshold: "4" }, two, /between 1 and 3/],
      [{ kind: "swapOwner", oldOwner: a, newOwner: b }, two, /already an owner/],
      [{ kind: "swapOwner", oldOwner: c, newOwner: "0x0000000000000000000000000000000000000001" }, two, /not an owner/],
      [{ kind: "changeThreshold", threshold: "3" }, two, /between 1 and 2/],
      [{ kind: "changeThreshold", threshold: "0" }, two, /between 1 and 2/],
    ];
    for (const [fields, snap, error] of cases) {
      expect(() => buildSafeTx(form(fields), snap), JSON.stringify(fields)).toThrow(error);
    }
  });
});
