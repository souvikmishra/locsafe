import { useEffect, useEffectEvent, useState } from "react";
import { isAddress, type Hex } from "viem";
import { decodeShareLink, packageFromTx, parsePackage, validatePackage } from "../domain/package.ts";
import { adjustVInSignature } from "../domain/signatures.ts";
import { ZERO_ADDRESS, type SafeTx, type SignedTxPackage } from "../domain/types.ts";
import { e2eHardwareSigner, type HardwareKind, type HardwareSigner } from "../hw/types.ts";
import { installNetworkGuard } from "../net/guard.ts";
import { encodeOwnerChange, execDataFromPackage, prevOwnerOf } from "../rpc/execute.ts";
import {
  createRpcClient,
  isApprovedHash,
  isValidEip1271Signature,
  readSafe,
  type SafeSnapshot,
} from "../rpc/safe.ts";
import { AppShell } from "./AppShell.tsx";
import { Home } from "./Home.tsx";
import { goTo, parseHash, replaceRoute, type Route } from "./router.ts";
import { Connect } from "./screens/Connect.tsx";
import { Execute } from "./screens/Execute.tsx";
import { ImportTx } from "./screens/ImportTx.tsx";
import { NewTx } from "./screens/NewTx.tsx";
import { Review } from "./screens/Review.tsx";
import { SafeOverview } from "./screens/SafeOverview.tsx";
import { Share } from "./screens/Share.tsx";
import { Sign } from "./screens/Sign.tsx";
import { clearSession, isDevChainAllowed, loadSession, saveSession, type Session } from "./session.ts";
import { isPackageValidated } from "./steps.ts";
import { sameAddress } from "../lib/utils.ts";

function useRoute(onNavigate: () => void): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const navigated = useEffectEvent(onNavigate);
  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(window.location.hash));
      navigated();
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

// ponytail: one connection per device kind until Disconnect; reload if the device was unplugged.
const signers = new Map<HardwareKind, HardwareSigner>();

async function getSigner(kind: HardwareKind): Promise<HardwareSigner> {
  const injected = e2eHardwareSigner();
  if (injected) return injected;
  let signer = signers.get(kind);
  if (!signer) {
    signer =
      kind === "ledger"
        ? await (await import("../hw/ledger.ts")).connectLedger()
        : await (await import("../hw/trezor.ts")).connectTrezor();
    signers.set(kind, signer);
  }
  return signer;
}

function messageOf(err: unknown): string {
  if (err && typeof err === "object" && "shortMessage" in err && typeof err.shortMessage === "string") {
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : String(err);
}

function readSafeAt(rpcUrl: string, safeAddress: `0x${string}`): Promise<SafeSnapshot> {
  return readSafe({ rpcUrl, safeAddress, requireMainnet: !isDevChainAllowed() });
}

/** Rejects packages whose hashes or signatures don't hold against the Safe's on-chain state. */
async function validateAgainstChain(pkg: SignedTxPackage, snapshot: SafeSnapshot, rpcUrl: string) {
  if (pkg.chainId !== snapshot.chainId) {
    throw new Error(`This transaction is for chain ${pkg.chainId}, but your RPC is on chain ${snapshot.chainId}.`);
  }
  if (pkg.safeVersion !== snapshot.version) {
    throw new Error(`This transaction was built for Safe v${pkg.safeVersion}, but the Safe is v${snapshot.version}.`);
  }
  const client = createRpcClient(rpcUrl);
  const result = await validatePackage({
    pkg,
    currentOwners: snapshot.owners,
    isValidSignature: (signer, hash, data) =>
      isValidEip1271Signature({ client, signer, hash, signature: data }),
    isApprovedHash: (signer, hash) =>
      isApprovedHash({ client, safeAddress: pkg.safeAddress, owner: signer, hash }),
  });
  if (!result.ok) {
    throw new Error(`Rejected: ${result.reason}`);
  }
}

function buildSafeTx(form: FormData, snapshot: SafeSnapshot): SafeTx {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const address = (name: string, label: string) => {
    const value = text(name);
    if (!isAddress(value)) throw new Error(`${label} is not a valid address.`);
    return value;
  };
  const integer = (name: string, label: string) => {
    const value = text(name) || "0";
    if (!/^\d+$/.test(value)) throw new Error(`${label} must be a whole number.`);
    return BigInt(value);
  };
  const threshold = () => {
    const value = integer("threshold", "Threshold");
    if (value < 1n) throw new Error("Threshold must be at least 1.");
    return value;
  };

  let to = snapshot.address;
  let value = 0n;
  let data: Hex = "0x";
  let operation: 0 | 1 = 0;
  switch (text("kind")) {
    case "eth":
      to = address("to", "Recipient");
      value = integer("value", "Amount");
      break;
    case "arbitrary": {
      to = address("to", "Contract address");
      value = integer("value", "Amount");
      const raw = text("data") || "0x";
      if (!/^0x([0-9a-fA-F]{2})*$/.test(raw)) throw new Error("Data must be 0x-prefixed hex bytes.");
      data = raw as Hex;
      operation = text("operation") === "1" ? 1 : 0;
      break;
    }
    case "addOwner":
      data = encodeOwnerChange("addOwnerWithThreshold", {
        owner: address("owner", "New owner"),
        threshold: threshold(),
      });
      break;
    case "removeOwner": {
      const owner = address("owner", "Owner");
      data = encodeOwnerChange("removeOwner", {
        prevOwner: prevOwnerOf(snapshot.owners, owner),
        owner,
        threshold: threshold(),
      });
      break;
    }
    case "swapOwner": {
      const oldOwner = address("oldOwner", "Current owner");
      data = encodeOwnerChange("swapOwner", {
        prevOwner: prevOwnerOf(snapshot.owners, oldOwner),
        oldOwner,
        newOwner: address("newOwner", "New owner"),
      });
      break;
    }
    case "changeThreshold":
      data = encodeOwnerChange("changeThreshold", { threshold: threshold() });
      break;
    default:
      throw new Error("Choose a transaction type.");
  }
  return {
    to,
    value,
    data,
    operation,
    safeTxGas: 0n,
    baseGas: 0n,
    gasPrice: 0n,
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    nonce: snapshot.nonce,
  };
}

export default function App() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  // Handlers never set a message and then navigate, so clearing here can't hide their result.
  const route = useRoute(() => {
    setError(null);
    setStatus(null);
  });
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return loadSession();
    } catch {
      return null;
    }
  });
  const [busy, setBusy] = useState<string | null>(null);

  function persist(next: Session) {
    saveSession(next);
    setSession(next);
  }

  async function run(key: string, action: () => Promise<void>) {
    setError(null);
    setStatus(null);
    setBusy(key);
    try {
      await action();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    installNetworkGuard(session?.rpcUrl || "http://127.0.0.1");
  }, [session?.rpcUrl]);

  /** Single entry point for files, pasted links and #/p/ URLs. */
  async function acceptPackage(pkg: SignedTxPackage) {
    const rpcUrl = session?.rpcUrl;
    if (!rpcUrl) {
      // Reviewable offline; the Review screen flags it as not validated until Connect.
      persist({ rpcUrl: "", safeAddress: pkg.safeAddress, pkg });
      replaceRoute("verify");
      return;
    }
    const snapshot = await readSafeAt(rpcUrl, pkg.safeAddress);
    await validateAgainstChain(pkg, snapshot, rpcUrl);
    persist({ rpcUrl, safeAddress: pkg.safeAddress, snapshot, pkg });
    replaceRoute("verify");
  }

  const openShareLink = useEffectEvent((payload: string) => {
    void run("package", () =>
      acceptPackage(decodeShareLink(`#/p/${payload}`, { allowNonMainnet: isDevChainAllowed() })),
    );
  });

  useEffect(() => {
    // Opening a #/p/ link syncs app state with the URL, an external system.
    // oxlint-disable-next-line react/set-state-in-effect
    if (route.name === "package") openShareLink(route.payload);
  }, [route]);

  const connect = (rpcUrl: string, safeAddress: string) =>
    run("connect", async () => {
      if (!isAddress(safeAddress)) throw new Error("Safe address is not a valid address.");
      installNetworkGuard(rpcUrl);
      const snapshot = await readSafeAt(rpcUrl, safeAddress);
      const pending = sameAddress(session?.pkg?.safeAddress, snapshot.address) ? session?.pkg : undefined;
      if (pending) {
        try {
          await validateAgainstChain(pending, snapshot, rpcUrl);
        } catch (err) {
          persist({ rpcUrl, safeAddress, snapshot });
          throw new Error(`Connected, but the transaction you opened was dropped. ${messageOf(err)}`, {
            cause: err,
          });
        }
      }
      persist({ rpcUrl, safeAddress, snapshot, pkg: pending });
      goTo(pending ? "verify" : "safe");
    });

  const refresh = () =>
    run("refresh", async () => {
      if (!session?.rpcUrl) return;
      persist({ ...session, snapshot: await readSafeAt(session.rpcUrl, session.safeAddress) });
    });

  const build = (form: FormData) =>
    run("build", async () => {
      if (!session?.snapshot) throw new Error("Connect your Safe first.");
      // Re-read so nonce and owner order are current, not from when you connected.
      const snapshot = await readSafeAt(session.rpcUrl, session.safeAddress);
      const pkg = packageFromTx({
        safeAddress: snapshot.address,
        safeVersion: snapshot.version,
        tx: buildSafeTx(form, snapshot),
        chainId: snapshot.chainId,
      });
      persist({ ...session, snapshot, pkg });
      goTo("verify");
    });

  const importFile = (file: File) =>
    run("import-file", async () =>
      acceptPackage(parsePackage(await file.text(), { allowNonMainnet: isDevChainAllowed() })),
    );

  const importLink = (link: string) =>
    run("import-link", async () =>
      acceptPackage(decodeShareLink(link, { allowNonMainnet: isDevChainAllowed() })),
    );

  const sign = (kind: HardwareKind) =>
    run(`sign-${kind}`, async () => {
      const pkg = session?.pkg;
      if (!session || !pkg) return;
      const signer = await getSigner(kind);
      const address = await signer.getAddress();
      if (isPackageValidated(session) && !session.snapshot!.owners.some((o) => sameAddress(o, address))) {
        throw new Error(`${address} is not an owner of this Safe. Check the account on your ${kind}.`);
      }
      const signature = adjustVInSignature(await signer.signSafeTx(pkg.hashes));
      persist({
        ...session,
        pkg: {
          ...pkg,
          signatures: [
            ...pkg.signatures.filter((s) => !sameAddress(s.signer, address)),
            { signer: address, data: signature, kind: "eoa" },
          ],
        },
      });
      setStatus(`Signed with ${kind} as ${address}`);
    });

  const execute = (kind: HardwareKind) =>
    run(`execute-${kind}`, async () => {
      if (!session?.pkg) return;
      const pkg = session.pkg;
      if (!session.rpcUrl) throw new Error("Connect to your RPC first.");
      const client = createRpcClient(session.rpcUrl);
      const chainId = await client.getChainId();
      if (chainId !== pkg.chainId) {
        throw new Error(`Your RPC is on chain ${chainId}, but this transaction is for chain ${pkg.chainId}.`);
      }
      const signer = await getSigner(kind);
      const from = await signer.getAddress();
      const data = execDataFromPackage(pkg);
      const nonce = await client.getTransactionCount({ address: from });
      const fees = await client.estimateFeesPerGas();
      const gas = await client.estimateGas({ account: from, to: pkg.safeAddress, data });
      const signed = await signer.signEthereumTx({
        chainId,
        nonce,
        gas,
        maxFeePerGas: fees.maxFeePerGas ?? 1n,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 1n,
        to: pkg.safeAddress,
        data,
      });
      const hash = await client.sendRawTransaction({ serializedTransaction: signed.raw });
      setStatus(`Broadcast ${hash}`);
    });

  function disconnect() {
    clearSession();
    signers.clear();
    setSession(null);
    setError(null);
    setStatus(null);
    goTo("connect");
  }

  if (route.name === "home") {
    return <Home session={session} />;
  }

  const screen = (() => {
    switch (route.name) {
      case "connect":
        return <Connect session={session} busy={busy} onConnect={connect} />;
      case "safe":
        return <SafeOverview session={session} busy={busy} onRefresh={refresh} />;
      case "new":
        return <NewTx session={session} busy={busy} onBuild={build} />;
      case "import":
        return (
          <ImportTx session={session} busy={busy} onImportFile={importFile} onImportLink={importLink} />
        );
      case "verify":
        return <Review session={session} />;
      case "sign":
        return <Sign session={session} busy={busy} onSign={sign} />;
      case "export":
        return <Share session={session} />;
      case "execute":
        return <Execute session={session} busy={busy} onExecute={execute} />;
      case "package":
        return <ImportTx session={session} busy={busy} onImportFile={importFile} onImportLink={importLink} />;
    }
  })();

  return (
    <AppShell route={route} session={session} error={error} status={status} onDisconnect={disconnect}>
      {screen}
    </AppShell>
  );
}
