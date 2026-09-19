import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli } from "./main.ts";

const golden = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../testdata/golden/arbitrum-addOwner.json",
    ),
    "utf8",
  ),
);

describe("locsafe-hash CLI", () => {
  it("prints the three hashes for the pcaversaccio golden vector", async () => {
    const lines: string[] = [];
    const code = await runCli(
      [
        "--safe",
        golden.safeAddress,
        "--chain-id",
        String(golden.chainId),
        "--version",
        golden.safeVersion,
        "--to",
        golden.transaction.to,
        "--value",
        golden.transaction.value,
        "--data",
        golden.transaction.data,
        "--operation",
        String(golden.transaction.operation),
        "--nonce",
        golden.transaction.nonce,
      ],
      { log: (s) => lines.push(s), err: () => {} },
    );
    expect(code).toBe(0);
    expect(lines[0].toLowerCase()).toBe(
      `Domain hash: ${golden.hashes.domainHash}`.toLowerCase(),
    );
    expect(lines[1].toLowerCase()).toBe(
      `Message hash: ${golden.hashes.messageHash}`.toLowerCase(),
    );
    expect(lines[2].toLowerCase()).toBe(
      `Safe transaction hash: ${golden.hashes.safeTxHash}`.toLowerCase(),
    );
    expect(lines[3]).toMatch(/addOwnerWithThreshold/);
  });
});
