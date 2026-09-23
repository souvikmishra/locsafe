import { ArrowRightIcon, TriangleAlertIcon, UsbIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.tsx";
import { Button, buttonVariants } from "../../components/ui/button.tsx";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import type { HardwareKind } from "../../hw/types.ts";
import { hrefFor } from "../router.ts";
import type { Session } from "../session.ts";
import { isPackageValidated } from "../steps.ts";
import { BusyIcon, HashPanel, NoTransaction, NonceNotice, SignatureList } from "../tx-parts.tsx";

const CHECKLIST = [
  "Plug in and unlock your Ledger or Trezor, and open its Ethereum app.",
  "Ledger only: turn on Blind signing in the Ethereum app's settings.",
  "Press a button below. Your device shows a domain hash and a message hash.",
  "Compare both with the hashes on this page, character by character. Approve only if they match exactly; otherwise reject.",
];

export function Sign({
  session,
  busy,
  onSign,
}: {
  session: Session | null;
  busy: string | null;
  onSign: (kind: HardwareKind) => void;
}) {
  const pkg = session?.pkg;
  if (!pkg) return <NoTransaction />;
  const validated = isPackageValidated(session);
  const signing = busy?.startsWith("sign-");
  return (
    <section data-testid="sign" className="grid gap-4">
      {!validated ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Connect before signing</AlertTitle>
          <AlertDescription>
            <p>
              Signing needs your RPC so the signatures already in this transaction, and the account
              on your device, can be checked against the Safe's current owners.
            </p>
            <a href={hrefFor("connect")} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Connect
            </a>
          </AlertDescription>
        </Alert>
      ) : null}
      <NonceNotice pkg={pkg} snapshot={session?.snapshot} />
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Before you approve on your device</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3">
            {CHECKLIST.map((item, index) => (
              <li key={item} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="pt-0.5">{item}</span>
              </li>
            ))}
          </ol>
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button onClick={() => onSign("ledger")} disabled={signing || !validated}>
            <BusyIcon busy={busy === "sign-ledger"}>
              <UsbIcon />
            </BusyIcon>
            Sign with Ledger
          </Button>
          <Button onClick={() => onSign("trezor")} disabled={signing || !validated}>
            <BusyIcon busy={busy === "sign-trezor"}>
              <UsbIcon />
            </BusyIcon>
            Sign with Trezor
          </Button>
        </CardFooter>
      </Card>
      <HashPanel hashes={pkg.hashes} />
      <SignatureList pkg={pkg} snapshot={session?.snapshot} />
      {pkg.signatures.length ? (
        <a href={hrefFor("export")} className={buttonVariants({ className: "w-fit" })}>
          Continue to share
          <ArrowRightIcon />
        </a>
      ) : null}
    </section>
  );
}
