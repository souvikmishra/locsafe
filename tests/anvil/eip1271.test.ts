import { parseEther } from "viem";
import { describe, expect, it } from "vitest";
import { packNestedSafeSignature } from "../../src/domain/eip1271.ts";
import { packageFromTx } from "../../src/domain/package.ts";
import {
  adjustVInSignature,
  buildSignatureBytes,
  SafeSignature,
} from "../../src/domain/signatures.ts";
import { ZERO_ADDRESS, type SafeTx } from "../../src/domain/types.ts";
import { encodeApproveHash, execDataFromPackage } from "../../src/rpc/execute.ts";
import { isApprovedHash, isValidEip1271Signature, readSafe } from "../../src/rpc/safe.ts";
import { withAnvil } from "../helpers/anvil.ts";

describe("approveHash and nested EIP-1271", () => {
  it(
    "executes an outer Safe using packed nested owner signatures",
    async () => {
      await withAnvil(async ({ rpcUrl, client, wallet, accounts, deploySafe }) => {
        const [executor, nestedOwner, extra] = accounts;
        const nested = await deploySafe({
          owners: [nestedOwner.address],
          threshold: 1,
          version: "1.4.1",
        });
        const outer = await deploySafe({
          owners: [nested],
          threshold: 1,
          version: "1.4.1",
        });
        await wallet.sendTransaction({
          to: outer,
          value: parseEther("1"),
          account: executor,
          chain: wallet.chain,
        });

        const tx: SafeTx = {
          to: extra.address,
          value: parseEther("0.01"),
          data: "0x",
          operation: 0,
          safeTxGas: 0n,
          baseGas: 0n,
          gasPrice: 0n,
          gasToken: ZERO_ADDRESS,
          refundReceiver: ZERO_ADDRESS,
          nonce: 0n,
        };
        const pkg = packageFromTx({
          safeAddress: outer,
          safeVersion: "1.4.1",
          tx,
          chainId: 31337,
        });
        const nestedSig = adjustVInSignature(
          await nestedOwner.sign({ hash: pkg.hashes.safeTxHash }),
        );
        const wrapped = packNestedSafeSignature({
          nestedSafe: nested,
          nestedOwnerSignatures: [new SafeSignature(nestedOwner.address, nestedSig)],
        });
        expect(buildSignatureBytes([wrapped]).length).toBeGreaterThan(2);
        const valid = await isValidEip1271Signature({
          client,
          signer: nested,
          hash: pkg.hashes.safeTxHash,
          signature: nestedSig,
        });
        expect(valid).toBe(true);

        pkg.signatures = [
          {
            signer: nested,
            data: wrapped.data as `0x${string}`,
            kind: "eip1271",
          },
        ];
        const hash = await wallet.sendTransaction({
          to: outer,
          data: execDataFromPackage(pkg),
          account: executor,
          chain: wallet.chain,
        });
        const receipt = await client.waitForTransactionReceipt({ hash });
        expect(receipt.status).toBe("success");
        const after = await readSafe({
          rpcUrl,
          safeAddress: outer,
          requireMainnet: false,
          client,
        });
        expect(after.nonce).toBe(1n);
      });
    },
    30_000,
  );

  it(
    "records approveHash for an owner",
    async () => {
      await withAnvil(async ({ client, wallet, accounts, deploySafe }) => {
        const owner = accounts[0];
        const safeAddress = await deploySafe({
          owners: [owner.address],
          threshold: 1,
          version: "1.3.0",
        });
        const hash =
          "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
        const txHash = await wallet.sendTransaction({
          to: safeAddress,
          data: encodeApproveHash(hash),
          account: owner,
          chain: wallet.chain,
        });
        await client.waitForTransactionReceipt({ hash: txHash });
        expect(
          await isApprovedHash({
            client,
            safeAddress,
            owner: owner.address,
            hash,
          }),
        ).toBe(true);
      });
    },
    30_000,
  );
});
