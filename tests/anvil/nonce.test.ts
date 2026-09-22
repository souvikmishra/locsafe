import { parseEther } from "viem";
import { describe, expect, it } from "vitest";
import { packageFromTx } from "../../src/domain/package.ts";
import { adjustVInSignature } from "../../src/domain/signatures.ts";
import { ZERO_ADDRESS, type SafeTx } from "../../src/domain/types.ts";
import { execDataFromPackage } from "../../src/rpc/execute.ts";
import { readSafe } from "../../src/rpc/safe.ts";
import { withAnvil } from "../helpers/anvil.ts";

function transferTx(to: `0x${string}`, nonce: bigint, value = 0n): SafeTx {
  return {
    to,
    value,
    data: "0x",
    operation: 0,
    safeTxGas: 0n,
    baseGas: 0n,
    gasPrice: 0n,
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    nonce,
  };
}

describe("nonce races on MockSafe", () => {
  it(
    "covers stale, competing, already-executed, and replaced transactions",
    async () => {
      await withAnvil(async ({ rpcUrl, client, wallet, accounts, deploySafe }) => {
        const owner = accounts[0];
        const safeAddress = await deploySafe({
          owners: [owner.address],
          threshold: 1,
          version: "1.4.1",
        });
        await wallet.sendTransaction({
          to: safeAddress,
          value: parseEther("1"),
          account: owner,
          chain: wallet.chain,
        });

        const snapshot = await readSafe({
          rpcUrl,
          safeAddress,
          requireMainnet: false,
          client,
        });
        expect(snapshot.version).toBe("1.4.1");
        expect(snapshot.nonce).toBe(0n);

        const recipientA = accounts[1].address;
        const recipientB = accounts[2].address;
        const txA = transferTx(recipientA, 0n, parseEther("0.01"));
        const txB = transferTx(recipientB, 0n, parseEther("0.01"));
        const pkgA = packageFromTx({
          safeAddress,
          safeVersion: "1.4.1",
          tx: txA,
          chainId: 31337,
        });
        const pkgB = packageFromTx({
          safeAddress,
          safeVersion: "1.4.1",
          tx: txB,
          chainId: 31337,
        });
        pkgA.signatures = [
          {
            signer: owner.address,
            data: adjustVInSignature(await owner.sign({ hash: pkgA.hashes.safeTxHash })),
            kind: "eoa",
          },
        ];
        pkgB.signatures = [
          {
            signer: owner.address,
            data: adjustVInSignature(await owner.sign({ hash: pkgB.hashes.safeTxHash })),
            kind: "eoa",
          },
        ];

        const dataA = execDataFromPackage(pkgA);
        const dataB = execDataFromPackage(pkgB);
        const hashA = await wallet.sendTransaction({
          to: safeAddress,
          data: dataA,
          account: owner,
          chain: wallet.chain,
        });
        await client.waitForTransactionReceipt({ hash: hashA });

        await expect(
          client.call({ to: safeAddress, data: dataB, account: owner.address }),
        ).rejects.toThrow();

        await expect(
          client.call({ to: safeAddress, data: dataA, account: owner.address }),
        ).rejects.toThrow();

        const stale = packageFromTx({
          safeAddress,
          safeVersion: "1.4.1",
          tx: transferTx(recipientA, 0n, parseEther("0.02")),
          chainId: 31337,
        });
        stale.signatures = [
          {
            signer: owner.address,
            data: adjustVInSignature(await owner.sign({ hash: stale.hashes.safeTxHash })),
            kind: "eoa",
          },
        ];
        await expect(
          client.call({
            to: safeAddress,
            data: execDataFromPackage(stale),
            account: owner.address,
          }),
        ).rejects.toThrow();

        const current = await readSafe({
          rpcUrl,
          safeAddress,
          requireMainnet: false,
          client,
        });
        const dummy = packageFromTx({
          safeAddress,
          safeVersion: "1.4.1",
          tx: transferTx(safeAddress, current.nonce, 0n),
          chainId: 31337,
        });
        dummy.signatures = [
          {
            signer: owner.address,
            data: adjustVInSignature(await owner.sign({ hash: dummy.hashes.safeTxHash })),
            kind: "eoa",
          },
        ];
        const intended = packageFromTx({
          safeAddress,
          safeVersion: "1.4.1",
          tx: transferTx(recipientB, current.nonce, parseEther("0.01")),
          chainId: 31337,
        });
        intended.signatures = [
          {
            signer: owner.address,
            data: adjustVInSignature(
              await owner.sign({ hash: intended.hashes.safeTxHash }),
            ),
            kind: "eoa",
          },
        ];
        const dummyHash = await wallet.sendTransaction({
          to: safeAddress,
          data: execDataFromPackage(dummy),
          account: owner,
          chain: wallet.chain,
        });
        await client.waitForTransactionReceipt({ hash: dummyHash });
        await expect(
          client.call({
            to: safeAddress,
            data: execDataFromPackage(intended),
            account: owner.address,
          }),
        ).rejects.toThrow();
      });
    },
    30_000,
  );
});
