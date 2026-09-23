import type { ReactNode } from "react";
import { FileInputIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { Badge } from "../../components/ui/badge.tsx";
import { Button, buttonVariants } from "../../components/ui/button.tsx";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx";
import { cn, formatWei } from "../../lib/utils.ts";
import { hrefFor } from "../router.ts";
import type { Session } from "../session.ts";
import { CopyButton, Mono, NotConnected } from "../tx-parts.tsx";

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 rounded-lg bg-muted/60 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

export function SafeOverview({
  session,
  busy,
  onRefresh,
}: {
  session: Session | null;
  busy: string | null;
  onRefresh: () => void;
}) {
  const snapshot = session?.snapshot;
  if (!snapshot) return <NotConnected />;
  return (
    <div className="grid gap-4">
      <Card data-testid="dashboard">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Safe <Badge variant="secondary">v{snapshot.version}</Badge>
          </CardTitle>
          <CardDescription className="flex items-center gap-1">
            <Mono>{snapshot.address}</Mono>
            <CopyButton value={snapshot.address} label="Safe address" />
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={busy === "refresh"}>
              <RefreshCwIcon className={cn(busy === "refresh" && "animate-spin")} />
              Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-6">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Signatures needed">
              {snapshot.threshold} of {snapshot.owners.length}
            </Stat>
            <Stat label="Next nonce">{snapshot.nonce.toString()}</Stat>
            <Stat label="Balance">{formatWei(snapshot.balance)}</Stat>
            <Stat label="Network">{snapshot.chainId === 1 ? "Mainnet" : `Chain ${snapshot.chainId}`}</Stat>
          </dl>
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">Owners</h3>
            <ul className="grid gap-1">
              {snapshot.owners.map((owner) => (
                <li key={owner} className="flex items-center gap-1">
                  <Mono>{owner}</Mono>
                  <CopyButton value={owner} label="owner address" />
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <a href={hrefFor("new")} className={buttonVariants()}>
          <PlusIcon />
          Create a transaction
        </a>
        <a href={hrefFor("import")} className={buttonVariants({ variant: "outline" })}>
          <FileInputIcon />
          Open a transaction I received
        </a>
      </div>
    </div>
  );
}
