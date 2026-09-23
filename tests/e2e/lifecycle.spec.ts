import { test, expect } from "@playwright/test";
import { parseEther } from "viem";
import { adjustVInSignature } from "../../src/domain/signatures.ts";
import { withAnvil } from "../helpers/anvil.ts";

test("construct, export, import, and execute with injected hardware stub", async ({
  page,
}) => {
  test.setTimeout(60_000);
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

    await page.addInitScript(() => {
      localStorage.setItem("E2E_MODE", "true");
    });
    await page.exposeFunction(
      "__locsafeSignHash",
      async (hash: `0x${string}`) =>
        adjustVInSignature(await owner.sign({ hash })),
    );
    await page.exposeFunction(
      "__locsafeSignTx",
      async (tx: {
        chainId: number;
        nonce: number;
        gas: string;
        maxFeePerGas: string;
        maxPriorityFeePerGas: string;
        to: `0x${string}`;
        data: `0x${string}`;
        value?: string;
      }) => {
        const { serializeTransaction } = await import("viem");
        const raw = await owner.signTransaction({
          chainId: tx.chainId,
          type: "eip1559",
          nonce: tx.nonce,
          gas: BigInt(tx.gas),
          maxFeePerGas: BigInt(tx.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(tx.maxPriorityFeePerGas),
          to: tx.to,
          data: tx.data,
          value: BigInt(tx.value ?? "0"),
        });
        void serializeTransaction;
        return { raw, from: owner.address };
      },
    );
    await page.addInitScript((address: string) => {
      window.__LOCSAFE_E2E_HW__ = {
        kind: "ledger",
        getAddress: async () => address as `0x${string}`,
        signSafeTx: async (hashes) =>
          (await (window as unknown as { __locsafeSignHash: (h: string) => Promise<`0x${string}`> }).__locsafeSignHash(
            hashes.safeTxHash,
          )),
        signEthereumTx: async (tx) =>
          (window as unknown as {
            __locsafeSignTx: (tx: unknown) => Promise<{ raw: `0x${string}`; from: `0x${string}` }>;
          }).__locsafeSignTx({
            ...tx,
            gas: tx.gas.toString(),
            maxFeePerGas: tx.maxFeePerGas.toString(),
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString(),
            value: (tx.value ?? 0n).toString(),
          }),
      };
    }, owner.address);

    await page.goto("/#/connect");
    await page.locator('input[name="rpcUrl"]').fill(rpcUrl);
    await page.locator('input[name="safeAddress"]').fill(safeAddress);
    await page.getByRole("button", { name: "Load Safe" }).click();
    await expect(page.getByTestId("dashboard")).toBeVisible();

    await page.goto("/#/tx/new");
    await page.locator('select[name="kind"]').selectOption("eth");
    await page.locator('input[name="to"]').fill(accounts[1].address);
    await page.locator('input[name="value"]').fill("1000000000000000");
    await page.getByRole("button", { name: "Build transaction" }).click();
    await expect(page.getByTestId("hashes")).toBeVisible();

    await page.goto("/#/tx/sign");
    await page.getByRole("button", { name: "Sign with Ledger" }).click();
    await expect(page.locator(".status")).toContainText("Signed");

    const exported = await page.evaluate(() => sessionStorage.getItem("locsafe-session"));
    expect(exported).toContain("signatures");

    await page.goto("/#/tx/import");
    const session = JSON.parse(exported!);
    await page.setInputFiles('input[name="file"]', {
      name: "tx.locsafe.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(session.pkg, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      )),
    });
    await page.getByRole("button", { name: "Import package" }).click();
    await expect(page.getByTestId("verify")).toBeVisible();

    await page.goto("/#/tx/execute");
    await page.getByRole("button", { name: /broadcast with ledger/i }).click();
    await expect(page.locator(".status")).toContainText("Broadcast 0x");
    const status = await page.locator(".status").textContent();
    const hash = status?.match(/Broadcast (0x[a-fA-F0-9]+)/)?.[1] as `0x${string}`;
    const receipt = await client.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");
  });
});
