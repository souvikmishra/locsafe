import { useEffect, useState, type FormEvent } from "react";
import selectors from "../domain/4byte.json" with { type: "json" };
import { decodeCalldata, type SelectorDatabase } from "../domain/decode.ts";
import {
  decodeShareLink,
  encodeShareLink,
  packageFromTx,
  parsePackage,
  serializePackage,
  validatePackage,
} from "../domain/package.ts";
import { adjustVInSignature } from "../domain/signatures.ts";
import {
  ZERO_ADDRESS,
  type SafeTx,
  type SignedTxPackage,
} from "../domain/types.ts";
import { e2eHardwareSigner } from "../hw/types.ts";
import { installNetworkGuard } from "../net/guard.ts";
import { encodeOwnerChange, execDataFromPackage } from "../rpc/execute.ts";
import {
  createRpcClient,
  isApprovedHash,
  isValidEip1271Signature,
  readSafe,
  type SafeSnapshot,
} from "../rpc/safe.ts";
import { hrefFor, parseHash, type Route } from "./router.ts";
import { isDevChainAllowed, loadSession, saveSession, type Session } from "./session.ts";

const selectorDb = selectors as SelectorDatabase;

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash),
  );
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

function HashBox({ pkg }: { pkg: SignedTxPackage }) {
  return (
    <section className="hashes" data-testid="hashes">
      <p>
        <strong>Domain hash</strong>
        <code>{pkg.hashes.domainHash}</code>
      </p>
      <p>
        <strong>Message hash</strong>
        <code>{pkg.hashes.messageHash}</code>
      </p>
      <p>
        <strong>Safe transaction hash</strong>
        <code>{pkg.hashes.safeTxHash}</code>
      </p>
    </section>
  );
}

function CalldataView({ data }: { data: `0x${string}` }) {
  const decoded = decodeCalldata(data, { selectors: selectorDb });
  if (!decoded.verified) {
    return (
      <p className="unverified" data-testid="unverified">
        UNVERIFIED raw calldata: <code>{decoded.raw}</code>
      </p>
    );
  }
  return (
    <p data-testid="decoded">
      {decoded.signature}{" "}
      <code>
        {JSON.stringify(decoded.args, (_k, v) =>
          typeof v === "bigint" ? v.toString() : v,
        )}
      </code>
    </p>
  );
}

function Nav() {
  return (
    <nav>
      <a href={hrefFor("connect")}>Connect</a>
      <a href={hrefFor("safe")}>Safe</a>
      <a href={hrefFor("new")}>New tx</a>
      <a href={hrefFor("import")}>Import</a>
      <a href={hrefFor("verify")}>Verify</a>
      <a href={hrefFor("sign")}>Sign</a>
      <a href={hrefFor("export")}>Export</a>
      <a href={hrefFor("execute")}>Execute</a>
    </nav>
  );
}

export default function App() {
  const route = useRoute();
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return loadSession();
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function persist(next: Session) {
    saveSession(next);
    setSession(next);
  }

  useEffect(() => {
    installNetworkGuard(session?.rpcUrl || "http://127.0.0.1");
  }, [session?.rpcUrl]);

  useEffect(() => {
    if (route.name === "package") {
      try {
        const pkg = decodeShareLink(`#/p/${route.payload}`);
        const current = session ?? {
          rpcUrl: "",
          safeAddress: pkg.safeAddress,
        };
        persist({ ...current, pkg, safeAddress: pkg.safeAddress });
        window.location.hash = "/tx/verify";
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }, [route]);

  async function onConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const rpcUrl = String(form.get("rpcUrl") ?? "").trim();
    const safeAddress = String(form.get("safeAddress") ?? "").trim() as `0x${string}`;
    installNetworkGuard(rpcUrl);
    const snapshot = await readSafe({
      rpcUrl,
      safeAddress,
      requireMainnet: !isDevChainAllowed(),
    });
    persist({ rpcUrl, safeAddress, snapshot });
    window.location.hash = "/safe";
  }

  async function refreshSnapshot(): Promise<SafeSnapshot | undefined> {
    if (!session) return;
    const snapshot = await readSafe({
      rpcUrl: session.rpcUrl,
      safeAddress: session.safeAddress,
      requireMainnet: !isDevChainAllowed(),
    });
    persist({ ...session, snapshot });
    return snapshot;
  }

  async function onPropose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.snapshot) {
      setError("Connect a Safe first");
      return;
    }
    const form = new FormData(event.currentTarget);
    const kind = String(form.get("kind"));
    let data: `0x${string}` = "0x";
    let to = session.safeAddress;
    let value = 0n;
    if (kind === "eth") {
      to = String(form.get("to")) as `0x${string}`;
      value = BigInt(String(form.get("value") || "0"));
    } else if (kind === "arbitrary") {
      to = String(form.get("to")) as `0x${string}`;
      value = BigInt(String(form.get("value") || "0"));
      data = String(form.get("data") || "0x") as `0x${string}`;
    } else if (kind === "addOwner") {
      data = encodeOwnerChange("addOwnerWithThreshold", {
        owner: String(form.get("owner")) as `0x${string}`,
        threshold: BigInt(String(form.get("threshold"))),
      });
    } else if (kind === "removeOwner") {
      data = encodeOwnerChange("removeOwner", {
        prevOwner: String(form.get("prevOwner")) as `0x${string}`,
        owner: String(form.get("owner")) as `0x${string}`,
        threshold: BigInt(String(form.get("threshold"))),
      });
    } else if (kind === "swapOwner") {
      data = encodeOwnerChange("swapOwner", {
        prevOwner: String(form.get("prevOwner")) as `0x${string}`,
        oldOwner: String(form.get("oldOwner")) as `0x${string}`,
        newOwner: String(form.get("newOwner")) as `0x${string}`,
      });
    } else if (kind === "changeThreshold") {
      data = encodeOwnerChange("changeThreshold", {
        threshold: BigInt(String(form.get("threshold"))),
      });
    }
    const tx: SafeTx = {
      to,
      value,
      data,
      operation: Number(form.get("operation") || 0) as 0 | 1,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: ZERO_ADDRESS,
      refundReceiver: ZERO_ADDRESS,
      nonce: session.snapshot.nonce,
    };
    const pkg = packageFromTx({
      safeAddress: session.safeAddress,
      safeVersion: session.snapshot.version,
      tx,
      chainId: session.snapshot.chainId,
    });
    persist({ ...session, pkg });
    window.location.hash = "/tx/verify";
  }

  async function onImportFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = (event.currentTarget.elements.namedItem("file") as HTMLInputElement)
      .files?.[0];
    if (!file) return;
    const text = await file.text();
    const pkg = parsePackage(text, { allowNonMainnet: isDevChainAllowed() });
    if (!session) {
      persist({ rpcUrl: "", safeAddress: pkg.safeAddress, pkg });
      window.location.hash = "/tx/verify";
      return;
    }
    const snapshot =
      session.snapshot ??
      (await readSafe({
        rpcUrl: session.rpcUrl,
        safeAddress: pkg.safeAddress,
        requireMainnet: !isDevChainAllowed(),
      }));
    const result = await validatePackage({
      pkg,
      currentOwners: snapshot.owners,
      isValidSignature: (signer, hash, data) =>
        isValidEip1271Signature({
          client: createRpcClient(session.rpcUrl),
          signer,
          hash,
          signature: data,
        }),
      isApprovedHash: (signer, hash) =>
        isApprovedHash({
          client: createRpcClient(session.rpcUrl),
          safeAddress: pkg.safeAddress,
          owner: signer,
          hash,
        }),
    });
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    persist({ ...session, pkg, snapshot, safeAddress: pkg.safeAddress });
    window.location.hash = "/tx/verify";
  }

  async function onSign(kind: "ledger" | "trezor") {
    if (!session?.pkg) return;
    setError(null);
    const injected = e2eHardwareSigner();
    let signer = injected;
    if (!signer) {
      if (kind === "ledger") {
        const { connectLedger } = await import("../hw/ledger.ts");
        signer = await connectLedger();
      } else {
        const { connectTrezor } = await import("../hw/trezor.ts");
        signer = await connectTrezor();
      }
    }
    const address = await signer.getAddress();
    const signature = adjustVInSignature(
      await signer.signSafeTx(session.pkg.hashes),
    );
    const pkg = {
      ...session.pkg,
      signatures: [
        ...session.pkg.signatures.filter(
          (s) => s.signer.toLowerCase() !== address.toLowerCase(),
        ),
        { signer: address, data: signature, kind: "eoa" as const },
      ],
    };
    persist({ ...session, pkg });
    setStatus(`Signed with ${kind} as ${address}`);
  }

  async function onExecute() {
    if (!session?.pkg) return;
    setError(null);
    const injected = e2eHardwareSigner();
    if (!injected) {
      setError("Connect a hardware wallet to execute (Ledger or Trezor).");
      return;
    }
    const client = createRpcClient(session.rpcUrl);
    const from = await injected.getAddress();
    const data = execDataFromPackage(session.pkg);
    const nonce = await client.getTransactionCount({ address: from });
    const fees = await client.estimateFeesPerGas();
    const gas = await client.estimateGas({
      account: from,
      to: session.safeAddress,
      data,
    });
    const signed = await injected.signEthereumTx({
      chainId: session.snapshot?.chainId ?? 1,
      nonce,
      gas,
      maxFeePerGas: fees.maxFeePerGas ?? 1n,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 1n,
      to: session.safeAddress,
      data,
    });
    const hash = await client.sendRawTransaction({
      serializedTransaction: signed.raw,
    });
    setStatus(`Broadcast ${hash}`);
  }

  const pkg = session?.pkg;

  return (
    <div className="app">
      <header>
        <h1>locsafe</h1>
        <p>RPC-only Safe signing. Match the hashes on your hardware wallet.</p>
        <Nav />
      </header>
      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="status">{status}</p> : null}

      {route.name === "connect" ? (
        <form onSubmit={onConnect} data-testid="connect-form">
          <label>
            JSON-RPC URL
            <input name="rpcUrl" required placeholder="http://127.0.0.1:8545" />
          </label>
          <label>
            Safe address
            <input name="safeAddress" required placeholder="0x..." />
          </label>
          <button type="submit">Load Safe</button>
        </form>
      ) : null}

      {route.name === "safe" && session?.snapshot ? (
        <section data-testid="dashboard">
          <p>Address: {session.snapshot.address}</p>
          <p>Version: {session.snapshot.version}</p>
          <p>Threshold: {session.snapshot.threshold}</p>
          <p>Nonce: {session.snapshot.nonce.toString()}</p>
          <p>Balance: {session.snapshot.balance.toString()} wei</p>
          <p>Owners:</p>
          <ul>
            {session.snapshot.owners.map((owner) => (
              <li key={owner}>{owner}</li>
            ))}
          </ul>
          <button type="button" onClick={() => void refreshSnapshot()}>
            Refresh
          </button>
        </section>
      ) : null}

      {route.name === "new" ? (
        <form onSubmit={onPropose} data-testid="new-tx-form">
          <label>
            Type
            <select name="kind" defaultValue="eth">
              <option value="eth">ETH transfer</option>
              <option value="arbitrary">Arbitrary call</option>
              <option value="addOwner">Add owner</option>
              <option value="removeOwner">Remove owner</option>
              <option value="swapOwner">Swap owner</option>
              <option value="changeThreshold">Change threshold</option>
            </select>
          </label>
          <label>
            To
            <input name="to" placeholder="0x..." />
          </label>
          <label>
            Value (wei)
            <input name="value" defaultValue="0" />
          </label>
          <label>
            Data
            <input name="data" defaultValue="0x" />
          </label>
          <label>
            Operation (0=call, 1=delegatecall)
            <input name="operation" defaultValue="0" />
          </label>
          <label>
            Owner
            <input name="owner" />
          </label>
          <label>
            Prev owner
            <input name="prevOwner" />
          </label>
          <label>
            Old owner
            <input name="oldOwner" />
          </label>
          <label>
            New owner
            <input name="newOwner" />
          </label>
          <label>
            Threshold
            <input name="threshold" />
          </label>
          <button type="submit">Build transaction</button>
        </form>
      ) : null}

      {route.name === "verify" && pkg ? (
        <section data-testid="verify">
          <HashBox pkg={pkg} />
          <CalldataView data={pkg.transaction.data} />
          <p>
            To: {pkg.transaction.to} value={pkg.transaction.value} nonce=
            {pkg.transaction.nonce}
          </p>
          <p>Signatures: {pkg.signatures.length}</p>
        </section>
      ) : null}

      {route.name === "sign" && pkg ? (
        <section data-testid="sign">
          <HashBox pkg={pkg} />
          <p>Confirm the domain hash and message hash on the device.</p>
          <button type="button" onClick={() => void onSign("ledger")}>
            Sign with Ledger
          </button>
          <button type="button" onClick={() => void onSign("trezor")}>
            Sign with Trezor
          </button>
        </section>
      ) : null}

      {route.name === "export" && pkg ? (
        <section data-testid="export">
          <HashBox pkg={pkg} />
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([serializePackage(pkg)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "tx.locsafe.json";
              a.click();
            }}
          >
            Download .locsafe.json
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                void navigator.clipboard.writeText(encodeShareLink(pkg));
                setStatus("Copied share link");
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            Copy share link
          </button>
        </section>
      ) : null}

      {route.name === "import" ? (
        <form onSubmit={onImportFile} data-testid="import-form">
          <input name="file" type="file" accept=".json,.locsafe.json" />
          <button type="submit">Import package</button>
        </form>
      ) : null}

      {route.name === "execute" && pkg ? (
        <section data-testid="execute">
          <HashBox pkg={pkg} />
          <p>Any funded account can broadcast once the threshold is met.</p>
          <button type="button" onClick={() => void onExecute()}>
            Sign ETH tx on hardware wallet and broadcast
          </button>
        </section>
      ) : null}
    </div>
  );
}
