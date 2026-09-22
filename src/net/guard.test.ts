import { afterEach, describe, expect, it, vi } from "vitest";
import { installNetworkGuard, NetworkGuardError, resetNetworkGuard, uninstallNetworkGuard } from "./guard.ts";

describe("network guard", () => {
  afterEach(() => {
    uninstallNetworkGuard();
    resetNetworkGuard();
    vi.unstubAllGlobals();
  });

  it("throws when fetch targets the Safe Transaction Service", async () => {
    installNetworkGuard("http://127.0.0.1:8545");

    await expect(fetch("https://safe-transaction-mainnet.safe.global/api/v1/safes/0x1/")).rejects.toThrow(
      NetworkGuardError,
    );
  });

  it("allows fetch to the configured JSON-RPC origin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    resetNetworkGuard();
    installNetworkGuard("http://127.0.0.1:8545");

    await fetch("http://127.0.0.1:8545", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("blocks WebSocket connections that are not the RPC origin", () => {
    installNetworkGuard("http://127.0.0.1:8545");
    expect(() => new WebSocket("wss://relay.walletconnect.com")).toThrow(NetworkGuardError);
  });
});
