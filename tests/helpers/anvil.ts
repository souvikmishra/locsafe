import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { foundry } from "viem/chains";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

const artifact = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../testdata/MockSafe.json"),
    "utf8",
  ),
) as { abi: unknown[]; bytecode: Hex };

export const ANVIL_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
] as const;

export type AnvilCtx = {
  rpcUrl: string;
  client: PublicClient;
  wallet: WalletClient;
  accounts: PrivateKeyAccount[];
  deploySafe: (args: {
    owners: `0x${string}`[];
    threshold: number;
    version: "1.3.0" | "1.4.1";
  }) => Promise<`0x${string}`>;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRpc(rpcUrl: string): Promise<void> {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      });
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await wait(100);
  }
  throw new Error(`Anvil did not start at ${rpcUrl}`);
}

export async function withAnvil<T>(fn: (ctx: AnvilCtx) => Promise<T>): Promise<T> {
  const port = 18545 + Math.floor(Math.random() * 1000);
  const rpcUrl = `http://127.0.0.1:${port}`;
  const anvil = spawn("anvil", ["--port", String(port), "--chain-id", "31337", "--silent"], {
    stdio: "ignore",
  }) as ChildProcess;
  try {
    await waitForRpc(rpcUrl);
    const accounts = ANVIL_KEYS.map((key) => privateKeyToAccount(key));
    const client = createPublicClient({
      chain: foundry,
      transport: http(rpcUrl),
    });
    const wallet = createWalletClient({
      chain: foundry,
      transport: http(rpcUrl),
      account: accounts[0],
    });
    const deploySafe: AnvilCtx["deploySafe"] = async ({
      owners,
      threshold,
      version,
    }) => {
      const hash = await wallet.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: [owners, BigInt(threshold), version],
        chain: foundry,
        account: accounts[0],
      } as never);
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) {
        throw new Error("Safe deploy produced no address");
      }
      return receipt.contractAddress;
    };
    return await fn({ rpcUrl, client, wallet, accounts, deploySafe });
  } finally {
    anvil.kill("SIGTERM");
  }
}
