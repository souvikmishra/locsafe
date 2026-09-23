import { ArrowRightIcon, PenLineIcon, RocketIcon, Share2Icon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.tsx";
import { buttonVariants } from "../../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import type { SignedTxPackage } from "../../domain/types.ts";
import { hrefFor } from "../router.ts";
import type { Session } from "../session.ts";
import { isPackageValidated, isThresholdMet } from "../steps.ts";
import {
  CalldataView,
  CopyButton,
  HashPanel,
  NoTransaction,
  NonceNotice,
  SignatureList,
  TxDetails,
} from "../tx-parts.tsx";

function crossCheckCommand(pkg: SignedTxPackage): string {
  const tx = pkg.transaction;
  return [
    "pnpm locsafe-hash",
    `--safe ${pkg.safeAddress}`,
    `--chain-id ${pkg.chainId}`,
    `--version ${pkg.safeVersion}`,
    `--to ${tx.to}`,
    `--value ${tx.value}`,
    `--data ${tx.data}`,
    `--operation ${tx.operation}`,
    `--safe-tx-gas ${tx.safeTxGas}`,
    `--base-gas ${tx.baseGas}`,
    `--gas-price ${tx.gasPrice}`,
    `--gas-token ${tx.gasToken}`,
    `--refund-receiver ${tx.refundReceiver}`,
    `--nonce ${tx.nonce}`,
  ].join(" \\\n  ");
}

export function Review({ session }: { session: Session | null }) {
  const pkg = session?.pkg;
  if (!pkg) return <NoTransaction />;
  const command = crossCheckCommand(pkg);
  return (
    <section data-testid="verify" className="grid gap-4">
      {!isPackageValidated(session) ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Signatures not checked yet</AlertTitle>
          <AlertDescription>
            <p>Connect to your RPC so they can be checked against the Safe's current owners.</p>
            <a href={hrefFor("connect")} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Connect
            </a>
          </AlertDescription>
        </Alert>
      ) : null}
      <NonceNotice pkg={pkg} snapshot={session?.snapshot} />
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>What this transaction does</CardTitle>
          <CardDescription>Decoded offline from a bundled function-signature list.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <CalldataView data={pkg.transaction.data} />
          <TxDetails pkg={pkg} />
        </CardContent>
      </Card>
      <HashPanel hashes={pkg.hashes} />
      <SignatureList pkg={pkg} snapshot={session?.snapshot} />
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Check with an independent tool</CardTitle>
          <CardDescription>
            Run this in a terminal from the locsafe repository, or enter the same fields into
            pcaversaccio's safe-tx-hashes-util. All three hashes must match the ones above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3">
            <pre className="flex-1 overflow-x-auto contain-inline-size font-mono text-xs leading-relaxed">{command}</pre>
            <CopyButton value={command} label="command" />
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <a href={hrefFor("sign")} className={buttonVariants()}>
          <PenLineIcon />
          Continue to sign
          <ArrowRightIcon />
        </a>
        <a href={hrefFor("export")} className={buttonVariants({ variant: "outline" })}>
          <Share2Icon />
          Share without signing
        </a>
        {isThresholdMet(session) ? (
          <a href={hrefFor("execute")} className={buttonVariants({ variant: "outline" })}>
            <RocketIcon />
            Go to execute
          </a>
        ) : null}
      </div>
    </section>
  );
}
