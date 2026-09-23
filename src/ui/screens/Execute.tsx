import { RocketIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import type { HardwareKind } from "../../hw/types.ts";
import type { Session } from "../session.ts";
import { isPackageValidated, isThresholdMet } from "../steps.ts";
import { BusyIcon, HashPanel, NoTransaction, NonceNotice, SignatureList } from "../tx-parts.tsx";

export function Execute({
  session,
  busy,
  onExecute,
}: {
  session: Session | null;
  busy: string | null;
  onExecute: (kind: HardwareKind) => void;
}) {
  const pkg = session?.pkg;
  if (!pkg) return <NoTransaction />;
  const validated = isPackageValidated(session);
  const executing = busy?.startsWith("execute-");
  return (
    <section data-testid="execute" className="grid gap-4">
      {!validated ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Not connected</AlertTitle>
          <AlertDescription>Connect to your RPC first; execution goes through it.</AlertDescription>
        </Alert>
      ) : !isThresholdMet(session) ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Not enough signatures yet</AlertTitle>
          <AlertDescription>
            {pkg.signatures.length} of {session?.snapshot?.threshold} collected. The Safe will
            reject it until the threshold is met.
          </AlertDescription>
        </Alert>
      ) : null}
      <NonceNotice pkg={pkg} snapshot={session?.snapshot} />
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Broadcast from a hardware wallet</CardTitle>
          <CardDescription>
            Your device signs an ordinary Ethereum transaction that calls execTransaction on the
            Safe. That account pays the gas and doesn't need to be an owner. On Ledger, Blind
            signing must be on.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-wrap gap-2">
          <Button onClick={() => onExecute("ledger")} disabled={executing}>
            <BusyIcon busy={busy === "execute-ledger"}>
              <RocketIcon />
            </BusyIcon>
            Broadcast with Ledger
          </Button>
          <Button onClick={() => onExecute("trezor")} disabled={executing}>
            <BusyIcon busy={busy === "execute-trezor"}>
              <RocketIcon />
            </BusyIcon>
            Broadcast with Trezor
          </Button>
        </CardFooter>
      </Card>
      <SignatureList pkg={pkg} snapshot={session?.snapshot} />
      <HashPanel hashes={pkg.hashes} />
    </section>
  );
}
