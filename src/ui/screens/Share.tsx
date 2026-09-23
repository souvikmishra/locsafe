import { useMemo, useState } from "react";
import {
  CheckIcon,
  CircleCheckIcon,
  DownloadIcon,
  InfoIcon,
  LinkIcon,
  RocketIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.tsx";
import { Button, buttonVariants } from "../../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Textarea } from "../../components/ui/textarea.tsx";
import { encodeShareLink, serializePackage } from "../../domain/package.ts";
import type { SignedTxPackage } from "../../domain/types.ts";
import { hrefFor } from "../router.ts";
import type { Session } from "../session.ts";
import { isThresholdMet } from "../steps.ts";
import { HashPanel, NoTransaction } from "../tx-parts.tsx";

function download(pkg: SignedTxPackage) {
  const blob = new Blob([serializePackage(pkg)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tx-${pkg.transaction.nonce}-${pkg.hashes.safeTxHash.slice(2, 10)}.locsafe.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ShareLink({ pkg }: { pkg: SignedTxPackage }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const link = useMemo(() => {
    try {
      return window.location.href.split("#")[0] + encodeShareLink(pkg);
    } catch {
      return null; // over the 8 KB link limit
    }
  }, [pkg]);
  if (!link) {
    return (
      <p className="text-sm text-muted-foreground">
        This transaction is too large for a link. Send the file instead.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      <Button
        variant="outline"
        className="w-fit"
        onClick={() => {
          navigator.clipboard.writeText(link).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            },
            () => setFallback(true),
          );
        }}
      >
        {copied ? <CheckIcon className="text-success" /> : <LinkIcon />}
        {copied ? "Link copied" : "Copy share link"}
      </Button>
      {fallback ? (
        <Textarea
          readOnly
          value={link}
          aria-label="Share link"
          className="font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}

export function Share({ session }: { session: Session | null }) {
  const pkg = session?.pkg;
  if (!pkg) return <NoTransaction />;
  const threshold = session?.snapshot?.threshold;
  const ready = isThresholdMet(session);
  return (
    <section data-testid="export" className="grid gap-4">
      {ready ? (
        <Alert variant="success">
          <CircleCheckIcon />
          <AlertTitle>Ready to execute</AlertTitle>
          <AlertDescription>
            Enough owners have signed. Send it to whoever will execute it, or execute it yourself.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <InfoIcon />
          <AlertTitle>
            {threshold
              ? `Needs ${threshold - pkg.signatures.length} more signature${threshold - pkg.signatures.length === 1 ? "" : "s"}`
              : `${pkg.signatures.length} signature${pkg.signatures.length === 1 ? "" : "s"} so far`}
          </AlertTitle>
          <AlertDescription>Send it to another owner so they can review and sign.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Send a file</CardTitle>
            <CardDescription>Works for any size. Send it by email, chat or USB stick.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-fit" onClick={() => download(pkg)}>
              <DownloadIcon />
              Download .locsafe.json
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Send a link</CardTitle>
            <CardDescription>Opens this app with the transaction loaded. Nothing is uploaded.</CardDescription>
          </CardHeader>
          <CardContent>
            <ShareLink pkg={pkg} />
          </CardContent>
        </Card>
      </div>
      <p className="text-sm text-muted-foreground">
        Tip: tell the next owner the Safe transaction hash over a different channel, like a call,
        so they can confirm they received the same transaction.
      </p>
      <HashPanel hashes={pkg.hashes} />
      {ready ? (
        <a href={hrefFor("execute")} className={buttonVariants({ className: "w-fit" })}>
          <RocketIcon />
          Go to execute
        </a>
      ) : null}
    </section>
  );
}
