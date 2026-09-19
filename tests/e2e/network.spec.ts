import { test, expect } from "@playwright/test";

test("static UI loads with hash routing and does not call Safe infrastructure", async ({
  page,
}) => {
    const extraHosts: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    const host = new URL(url).hostname;
    if (
      host !== "127.0.0.1" &&
      host !== "localhost" &&
      !url.startsWith("data:") &&
      !url.startsWith("blob:")
    ) {
      extraHosts.push(url);
    }
  });

  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "locsafe" })).toBeVisible();
  await expect(page.getByTestId("connect-form")).toBeVisible();

  const blocked = await page.evaluate(async () => {
    try {
      await fetch("https://safe-transaction-mainnet.safe.global/api/v1/safes/0x1/");
      return "allowed";
    } catch (error) {
      return (error as Error).name;
    }
  });
  expect(blocked).toBe("NetworkGuardError");
  expect(extraHosts.filter((url) => url.includes("safe-transaction"))).toEqual([]);
});
