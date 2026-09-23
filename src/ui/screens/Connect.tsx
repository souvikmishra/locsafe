import { InfoIcon, PlugIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Input } from "../../components/ui/input.tsx";
import type { Session } from "../session.ts";
import { isPackageValidated } from "../steps.ts";
import { BusyIcon, Field } from "../tx-parts.tsx";

export function Connect({
  session,
  busy,
  onConnect,
}: {
  session: Session | null;
  busy: string | null;
  onConnect: (rpcUrl: string, safeAddress: string) => void;
}) {
  const pending = session?.pkg && !isPackageValidated(session);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection details</CardTitle>
        <CardDescription>
          Nothing leaves this browser except JSON-RPC calls to the URL you enter.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          data-testid="connect-form"
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            onConnect(
              String(form.get("rpcUrl") ?? "").trim(),
              String(form.get("safeAddress") ?? "").trim(),
            );
          }}
        >
          {pending ? (
            <Alert>
              <InfoIcon />
              <AlertTitle>A transaction is waiting</AlertTitle>
              <AlertDescription>
                Connect to check its signatures against the Safe's current owners.
              </AlertDescription>
            </Alert>
          ) : null}
          <Field
            id="rpcUrl"
            label="Ethereum RPC URL"
            hint="Your own node or a provider you trust, on Ethereum Mainnet. It's the only server this app contacts."
          >
            <Input
              id="rpcUrl"
              name="rpcUrl"
              type="url"
              required
              placeholder="https://…"
              defaultValue={session?.rpcUrl}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field id="safeAddress" label="Safe address" hint="The 0x… address of your Safe multisig.">
            <Input
              id="safeAddress"
              name="safeAddress"
              required
              placeholder="0x…"
              defaultValue={session?.safeAddress}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Button type="submit" className="w-fit" disabled={busy === "connect"}>
            <BusyIcon busy={busy === "connect"}>
              <PlugIcon />
            </BusyIcon>
            Load Safe
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
