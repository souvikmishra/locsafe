import { useState } from "react";
import { HammerIcon, OctagonAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Input } from "../../components/ui/input.tsx";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select.tsx";
import { Textarea } from "../../components/ui/textarea.tsx";
import type { SafeSnapshot } from "../../rpc/safe.ts";
import type { Session } from "../session.ts";
import { formatWei } from "../../lib/utils.ts";
import { BusyIcon, Field, NotConnected } from "../tx-parts.tsx";

const KINDS = {
  eth: { label: "Send ETH", about: "Send ETH from the Safe to an address." },
  arbitrary: {
    label: "Contract call",
    about: "Call any contract with raw calldata. Only use this if you know the exact bytes.",
  },
  addOwner: { label: "Add owner", about: "Add an owner and set how many signatures are needed." },
  removeOwner: {
    label: "Remove owner",
    about: "Remove an owner and set how many signatures are needed.",
  },
  swapOwner: { label: "Replace owner", about: "Swap one owner for a new address." },
  changeThreshold: {
    label: "Change threshold",
    about: "Change how many owners must sign each transaction.",
  },
} as const;

type Kind = keyof typeof KINDS;

function WeiField() {
  const [wei, setWei] = useState("0");
  const hint = /^\d+$/.test(wei) ? `= ${formatWei(wei)}` : "Whole number of wei (1 ETH = 10^18 wei)";
  return (
    <Field id="value" label="Amount (wei)" hint={hint}>
      <Input
        id="value"
        name="value"
        inputMode="numeric"
        value={wei}
        onChange={(event) => setWei(event.target.value.trim())}
        className="font-mono"
      />
    </Field>
  );
}

function AddressInput({ id, label, hint }: { id: string; label: string; hint?: string }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Input id={id} name={id} required placeholder="0x…" autoComplete="off" spellCheck={false} className="font-mono" />
    </Field>
  );
}

function OwnerSelect({ id, label, owners }: { id: string; label: string; owners: string[] }) {
  return (
    <Field id={id} label={label}>
      <NativeSelect id={id} name={id} required className="font-mono">
        {owners.map((owner) => (
          <NativeSelectOption key={owner} value={owner}>
            {owner}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

function ThresholdInput({ min, max, value }: { min: number; max: number; value: number }) {
  return (
    <Field id="threshold" label="Signatures needed afterwards" hint={`Between ${min} and ${max}.`}>
      <Input
        id="threshold"
        name="threshold"
        type="number"
        required
        min={min}
        max={max}
        defaultValue={Math.min(Math.max(value, min), max)}
        className="w-32"
      />
    </Field>
  );
}

function KindFields({ kind, snapshot }: { kind: Kind; snapshot: SafeSnapshot }) {
  const [operation, setOperation] = useState("0");
  const owners = snapshot.owners;
  switch (kind) {
    case "eth":
      return (
        <>
          <AddressInput id="to" label="Recipient address" />
          <WeiField />
        </>
      );
    case "arbitrary":
      return (
        <>
          <AddressInput id="to" label="Contract address" />
          <WeiField />
          <Field id="data" label="Calldata" hint="0x-prefixed hex. Anything that can't be decoded will be marked UNVERIFIED.">
            <Textarea id="data" name="data" defaultValue="0x" spellCheck={false} className="font-mono" />
          </Field>
          <Field id="operation" label="Operation">
            <NativeSelect id="operation" name="operation" value={operation} onChange={(e) => setOperation(e.target.value)}>
              <NativeSelectOption value="0">Call</NativeSelectOption>
              <NativeSelectOption value="1">Delegatecall</NativeSelectOption>
            </NativeSelect>
          </Field>
          {operation === "1" ? (
            <Alert variant="destructive">
              <OctagonAlertIcon />
              <AlertTitle>Delegatecall gives the target full control of the Safe</AlertTitle>
              <AlertDescription>Only use it for audited contracts you intend to run as the Safe.</AlertDescription>
            </Alert>
          ) : null}
        </>
      );
    case "addOwner":
      return (
        <>
          <AddressInput id="owner" label="New owner address" />
          <ThresholdInput min={1} max={owners.length + 1} value={snapshot.threshold} />
        </>
      );
    case "removeOwner":
      if (owners.length <= 1) {
        return (
          <p className="text-sm text-muted-foreground">
            This Safe has a single owner, and a Safe must keep at least one.
          </p>
        );
      }
      return (
        <>
          <OwnerSelect id="owner" label="Owner to remove" owners={owners} />
          <ThresholdInput min={1} max={owners.length - 1} value={snapshot.threshold} />
        </>
      );
    case "swapOwner":
      return (
        <>
          <OwnerSelect id="oldOwner" label="Owner to replace" owners={owners} />
          <AddressInput id="newOwner" label="New owner address" />
        </>
      );
    case "changeThreshold":
      return <ThresholdInput min={1} max={owners.length} value={snapshot.threshold} />;
  }
}

export function NewTx({
  session,
  busy,
  onBuild,
}: {
  session: Session | null;
  busy: string | null;
  onBuild: (form: FormData) => void;
}) {
  const [kind, setKind] = useState<Kind>("eth");
  const snapshot = session?.snapshot;
  if (!snapshot) return <NotConnected />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>New transaction</CardTitle>
        <CardDescription>
          Uses the Safe's next nonce, read from the chain when you build it (currently{" "}
          {snapshot.nonce.toString()}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          data-testid="new-tx-form"
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            onBuild(new FormData(event.currentTarget));
          }}
        >
          <Field id="kind" label="What do you want to do?" hint={KINDS[kind].about}>
            <NativeSelect id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              {(Object.keys(KINDS) as Kind[]).map((key) => (
                <NativeSelectOption key={key} value={key}>
                  {KINDS[key].label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {/* Keyed so switching type never carries values over between fields. */}
          <div key={kind} className="grid gap-5">
            <KindFields kind={kind} snapshot={snapshot} />
          </div>
          <Button type="submit" className="w-fit" disabled={busy === "build"}>
            <BusyIcon busy={busy === "build"}>
              <HammerIcon />
            </BusyIcon>
            Build transaction
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
