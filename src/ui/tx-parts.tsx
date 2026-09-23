import { useState, type ReactNode } from "react";
import {
  CheckIcon,
  CircleCheckIcon,
  CopyIcon,
  FileInputIcon,
  LoaderCircleIcon,
  OctagonAlertIcon,
  PlugIcon,
  PlusIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button, buttonVariants } from "../components/ui/button.tsx";
import { Label } from "../components/ui/label.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { decodeCalldata } from "../domain/decode.ts";
import { ZERO_ADDRESS, type SafeHashes, type SignedTxPackage } from "../domain/types.ts";
import type { SafeSnapshot } from "../rpc/safe.ts";
import { cn, formatWei, sameAddress } from "../lib/utils.ts";
import { hrefFor } from "./router.ts";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
    </Button>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cn("font-mono text-[13px] break-all", className)}>{children}</code>;
}

function HashRow({ label, value, onDevice }: { label: string; value: string; onDevice?: boolean }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {label}
        {onDevice ? <Badge variant="outline">Shown on your device</Badge> : null}
      </div>
      <div className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2">
        <Mono className="flex-1 pt-0.5 leading-relaxed">{value}</Mono>
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}

export function HashPanel({ hashes }: { hashes: SafeHashes }) {
  return (
    <Card data-testid="hashes" className="gap-4">
      <CardHeader>
        <CardTitle>Transaction hashes</CardTitle>
        <CardDescription>Computed on this machine from the transaction details.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <HashRow label="Domain hash" value={hashes.domainHash} onDevice />
        <HashRow label="Message hash" value={hashes.messageHash} onDevice />
        <HashRow label="Safe transaction hash" value={hashes.safeTxHash} />
      </CardContent>
    </Card>
  );
}

export function CalldataView({ data }: { data: `0x${string}` }) {
  const decoded = decodeCalldata(data);
  if (!decoded.verified) {
    return (
      <Alert variant="destructive" data-testid="unverified">
        <OctagonAlertIcon />
        <AlertTitle>UNVERIFIED calldata</AlertTitle>
        <AlertDescription>
          <p>
            This data could not be decoded. Do not sign unless you know exactly what these bytes
            do.
          </p>
          <Mono className="text-foreground">{decoded.raw}</Mono>
        </AlertDescription>
      </Alert>
    );
  }
  if (decoded.signature === "(empty)") {
    return (
      <p data-testid="decoded" className="text-sm text-muted-foreground">
        No calldata: a plain ETH transfer.
      </p>
    );
  }
  return (
    <div data-testid="decoded" className="grid gap-2 rounded-md border px-3 py-2">
      <div className="flex items-center gap-2">
        <Badge variant="success">
          <CircleCheckIcon />
          Decoded
        </Badge>
        <Mono className="font-semibold">{decoded.signature}</Mono>
      </div>
      {decoded.args.length ? (
        <ol className="grid gap-1 text-sm">
          {decoded.args.map((arg, index) => (
            <li key={index} className="flex gap-2">
              <span className="text-muted-foreground">#{index}</span>
              <Mono>{typeof arg === "bigint" ? arg.toString() : JSON.stringify(arg)}</Mono>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export function TxDetails({ pkg }: { pkg: SignedTxPackage }) {
  const tx = pkg.transaction;
  const hasGasRefund =
    tx.safeTxGas !== "0" ||
    tx.baseGas !== "0" ||
    tx.gasPrice !== "0" ||
    !sameAddress(tx.gasToken, ZERO_ADDRESS) ||
    !sameAddress(tx.refundReceiver, ZERO_ADDRESS);
  return (
    <div className="grid gap-3">
      <dl className="grid gap-3">
        <Detail label="To">
          <Mono>{tx.to}</Mono>
        </Detail>
        <Detail label="Value">
          {formatWei(tx.value)} <span className="text-muted-foreground">({tx.value} wei)</span>
        </Detail>
        <Detail label="Operation">
          {tx.operation === 1 ? (
            <Badge variant="destructive">Delegatecall</Badge>
          ) : (
            <Badge variant="secondary">Call</Badge>
          )}
        </Detail>
        <Detail label="Nonce">{tx.nonce}</Detail>
        <Detail label="Safe">
          <Mono>{pkg.safeAddress}</Mono>{" "}
          <span className="text-muted-foreground">v{pkg.safeVersion}</span>
        </Detail>
        <Detail label="Chain">{pkg.chainId === 1 ? "Ethereum Mainnet (1)" : `Chain ${pkg.chainId}`}</Detail>
        {hasGasRefund ? (
          <Detail label="Gas refund">
            <Badge variant="warning">Non-default</Badge>{" "}
            <span className="text-muted-foreground">
              safeTxGas {tx.safeTxGas}, baseGas {tx.baseGas}, gasPrice {tx.gasPrice}, token{" "}
              <Mono>{tx.gasToken}</Mono>, receiver <Mono>{tx.refundReceiver}</Mono>
            </span>
          </Detail>
        ) : null}
      </dl>
      {tx.operation === 1 ? (
        <Alert variant="destructive">
          <OctagonAlertIcon />
          <AlertTitle>Delegatecall</AlertTitle>
          <AlertDescription>
            The target code runs with full control over this Safe. Only sign if you expected
            exactly this.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function SignatureList({
  pkg,
  snapshot,
}: {
  pkg: SignedTxPackage;
  snapshot?: SafeSnapshot;
}) {
  const known = snapshot && sameAddress(snapshot.address, pkg.safeAddress) ? snapshot : undefined;
  const count = pkg.signatures.length;
  const signerOf = (owner: string) => pkg.signatures.find((s) => sameAddress(s.signer, owner));
  const rows = known ? known.owners : pkg.signatures.map((s) => s.signer);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          Signatures {count}
          {known ? ` of ${known.threshold} needed` : ""}
        </CardTitle>
        {known ? (
          <div className="flex gap-1 pt-1" aria-hidden="true">
            {Array.from({ length: known.threshold }, (_, i) => (
              <span
                key={i}
                className={cn("h-1.5 flex-1 rounded-full", i < count ? "bg-success" : "bg-muted")}
              />
            ))}
          </div>
        ) : (
          <CardDescription>Connect to see which owners still need to sign.</CardDescription>
        )}
      </CardHeader>
      {rows.length ? (
        <CardContent>
          <ul className="grid gap-2">
            {rows.map((address) => {
              const signature = signerOf(address);
              return (
                <li key={address} className="flex flex-wrap items-center justify-between gap-2">
                  <Mono>{address}</Mono>
                  {signature ? (
                    <Badge variant="success">
                      <CheckIcon />
                      Signed
                    </Badge>
                  ) : (
                    <Badge variant="outline">Waiting</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function NonceNotice({ pkg, snapshot }: { pkg: SignedTxPackage; snapshot?: SafeSnapshot }) {
  if (!snapshot || !sameAddress(snapshot.address, pkg.safeAddress)) return null;
  const nonce = BigInt(pkg.transaction.nonce);
  if (nonce < snapshot.nonce) {
    return (
      <Alert variant="destructive">
        <OctagonAlertIcon />
        <AlertTitle>Nonce {nonce.toString()} is already used</AlertTitle>
        <AlertDescription>
          The Safe is at nonce {snapshot.nonce.toString()}. This transaction was executed or
          replaced and can no longer run.
        </AlertDescription>
      </Alert>
    );
  }
  if (nonce > snapshot.nonce) {
    return (
      <Alert variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>Queued behind other transactions</AlertTitle>
        <AlertDescription>
          The Safe is at nonce {snapshot.nonce.toString()}; this one uses nonce{" "}
          {nonce.toString()}. The earlier nonces must execute first.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
        {icon}
      </div>
      <p className="font-medium">{title}</p>
      {children}
    </div>
  );
}

export function NotConnected() {
  return (
    <EmptyState icon={<PlugIcon />} title="Connect your Safe first">
      <p className="max-w-sm text-sm text-muted-foreground">
        This step needs the Safe's owners, threshold and nonce from the chain.
      </p>
      <a href={hrefFor("connect")} className={buttonVariants()}>
        Go to Connect
      </a>
    </EmptyState>
  );
}

export function NoTransaction() {
  return (
    <EmptyState icon={<FileInputIcon />} title="No transaction open yet">
      <p className="max-w-sm text-sm text-muted-foreground">
        Create a new transaction, or open the file or link another owner sent you.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <a href={hrefFor("new")} className={buttonVariants()}>
          <PlusIcon />
          Create
        </a>
        <a href={hrefFor("import")} className={buttonVariants({ variant: "outline" })}>
          <FileInputIcon />
          Import
        </a>
      </div>
    </EmptyState>
  );
}

export function BusyIcon({ busy, children }: { busy: boolean; children: ReactNode }) {
  return busy ? <LoaderCircleIcon className="animate-spin" /> : children;
}

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
