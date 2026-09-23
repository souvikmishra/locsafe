import { describe, expect, it } from "vitest";
import { packageFromTx } from "../domain/package.ts";
import { ZERO_ADDRESS } from "../domain/types.ts";
import type { SafeSnapshot } from "../rpc/safe.ts";
import type { Session } from "./session.ts";
import { isPackageValidated, stepForRoute, stepState } from "./steps.ts";

const safe = "0x2222222222222222222222222222222222222222" as const;
const owner = "0x1111111111111111111111111111111111111111" as const;

const snapshot: SafeSnapshot = {
  address: safe,
  chainId: 1,
  version: "1.4.1",
  owners: [owner],
  threshold: 1,
  nonce: 0n,
  balance: 0n,
};

const pkg = packageFromTx({
  safeAddress: safe,
  safeVersion: "1.4.1",
  tx: {
    to: owner,
    value: 1n,
    data: "0x",
    operation: 0,
    safeTxGas: 0n,
    baseGas: 0n,
    gasPrice: 0n,
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    nonce: 0n,
  },
});

const base: Session = { rpcUrl: "http://127.0.0.1:8545", safeAddress: safe };

describe("stepState", () => {
  it("tracks progress through the lifecycle", () => {
    expect(stepState("connect", null)).toBe("todo");
    expect(stepState("connect", { ...base, snapshot })).toBe("done");
    expect(stepState("create", { ...base, snapshot })).toBe("todo");
    expect(stepState("create", { ...base, snapshot, pkg })).toBe("done");
    expect(stepState("sign", { ...base, snapshot, pkg })).toBe("todo");
    expect(stepState("execute", { ...base, snapshot, pkg })).toBe("todo");

    const signed = {
      ...pkg,
      signatures: [{ signer: owner, data: "0x01" as const, kind: "eoa" as const }],
    };
    expect(stepState("sign", { ...base, snapshot, pkg: signed })).toBe("done");
    expect(stepState("execute", { ...base, snapshot, pkg: signed })).toBe("ready");
    expect(stepState("execute", { ...base, pkg: signed })).toBe("todo");
  });

  it("maps routes to steps", () => {
    expect(stepForRoute("safe")?.id).toBe("connect");
    expect(stepForRoute("import")?.id).toBe("create");
    expect(stepForRoute("home")).toBeUndefined();
  });
});

describe("isPackageValidated", () => {
  it("requires a snapshot of the package's Safe", () => {
    expect(isPackageValidated({ ...base, pkg })).toBe(false);
    expect(isPackageValidated({ ...base, snapshot, pkg })).toBe(true);
    expect(
      isPackageValidated({ ...base, snapshot: { ...snapshot, address: owner }, pkg }),
    ).toBe(false);
  });
});
