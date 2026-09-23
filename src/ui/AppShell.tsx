import { useEffect, useRef, type ReactNode } from "react";
import {
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  HouseIcon,
  LogOutIcon,
  ServerIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button, buttonVariants } from "../components/ui/button.tsx";
import { cn, shortAddress } from "../lib/utils.ts";
import { hrefFor, type Route, type RouteName } from "./router.ts";
import type { Session } from "./session.ts";
import { STEPS, stepForRoute, stepState, type Step, type StepId } from "./steps.ts";

/** The page's only heading that contains the product name. */
export function Brand() {
  return (
    <h1>
      <a href={hrefFor("home")} className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheckIcon className="size-4" />
        </span>
        locsafe
      </a>
    </h1>
  );
}

function rpcHost(rpcUrl?: string): string | null {
  if (!rpcUrl) return null;
  try {
    // Host only: API keys in the path or query must not end up in screen recordings.
    return new URL(rpcUrl).host;
  } catch {
    return null;
  }
}

function StepRail({ current, session }: { current?: StepId; session: Session | null }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // On mobile the rail scrolls sideways; bring the current step into view.
    list.current
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);
  return (
    <nav aria-label="Steps" className="min-w-0 md:sticky md:top-24 md:self-start">
      <ol ref={list} className="-mx-4 flex scroll-px-4 gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {STEPS.map((step) => {
          const state = stepState(step.id, session);
          const active = step.id === current;
          return (
            <li key={step.id} className="shrink-0">
              <a
                href={hrefFor(step.href)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-start gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent/60",
                  active && "bg-accent text-accent-foreground hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    state === "done" && "border-primary bg-primary text-primary-foreground",
                    state === "ready" && "border-success bg-success/10 text-success",
                    state === "todo" && (active ? "border-primary text-primary" : "text-muted-foreground"),
                  )}
                >
                  {state === "done" ? <CheckIcon className="size-3.5" /> : step.number}
                </span>
                <span className="grid gap-0.5 pt-1">
                  <span className="font-medium whitespace-nowrap md:whitespace-normal">{step.title}</span>
                  <span
                    className={cn(
                      "hidden text-xs md:block",
                      state === "ready" ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {state === "ready" ? "Enough signatures: ready to execute." : step.hint}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      {session?.snapshot ? (
        <a
          href={hrefFor("safe")}
          className="mt-6 hidden rounded-lg border bg-card p-3 text-xs transition-colors hover:bg-accent/60 md:block"
        >
          <span className="block font-medium">Your Safe</span>
          <span className="mt-1 block font-mono text-muted-foreground">
            {shortAddress(session.snapshot.address)}
          </span>
          <span className="mt-1 block text-muted-foreground">
            v{session.snapshot.version} · {session.snapshot.threshold} of{" "}
            {session.snapshot.owners.length} owners · nonce {session.snapshot.nonce.toString()}
          </span>
        </a>
      ) : null}
    </nav>
  );
}

function StepHeader({ step }: { step?: Step }) {
  return (
    <div className="grid gap-1">
      {step ? (
        <p className="text-sm font-medium text-primary">
          Step {step.number} of {STEPS.length}
        </p>
      ) : null}
      <h2 className="text-2xl font-semibold tracking-tight">{step?.title ?? "Opening a shared transaction"}</h2>
      <p className="text-muted-foreground">
        {step?.hint ?? "Checking the transaction in the link you opened."}
      </p>
    </div>
  );
}

function CreateOrImportSwitch({ route }: { route: RouteName }) {
  const tab = (name: RouteName, label: string) => (
    <a
      href={hrefFor(name)}
      aria-current={route === name ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground",
        route === name && "bg-background text-foreground shadow-sm",
      )}
    >
      {label}
    </a>
  );
  return (
    <div className="inline-flex w-fit rounded-lg bg-muted p-1 text-sm">
      {tab("new", "Create new")}
      {tab("import", "Import file or link")}
    </div>
  );
}

export function AppShell({
  route,
  session,
  error,
  status,
  onDisconnect,
  children,
}: {
  route: Route;
  session: Session | null;
  error: string | null;
  status: string | null;
  onDisconnect: () => void;
  children: ReactNode;
}) {
  const step = route.name === "package" ? undefined : stepForRoute(route.name);
  const host = rpcHost(session?.rpcUrl);
  const safeAddress = session?.snapshot?.address ?? session?.safeAddress;
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Brand />
          <a
            href={hrefFor("home")}
            aria-label="Home"
            className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground" })}
          >
            <HouseIcon />
            <span className="hidden sm:inline">Home</span>
          </a>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {safeAddress ? (
              <Badge variant="secondary" className="font-mono" title={safeAddress}>
                <WalletIcon />
                {shortAddress(safeAddress)}
              </Badge>
            ) : null}
            {host ? (
              <Badge variant="outline" className="hidden max-w-48 sm:inline-flex" title="JSON-RPC host">
                <ServerIcon />
                <span className="truncate">{host}</span>
              </Badge>
            ) : null}
            {session ? (
              <Button variant="ghost" size="sm" onClick={onDisconnect} aria-label="Disconnect">
                <LogOutIcon />
                <span className="hidden sm:inline">Disconnect</span>
              </Button>
            ) : null}
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10 md:py-10">
        <StepRail current={step?.id} session={session} />
        <main className="grid min-w-0 content-start gap-5">
          <StepHeader step={step} />
          {step?.id === "create" ? <CreateOrImportSwitch route={route.name as RouteName} /> : null}
          {error ? (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>That didn't work</AlertTitle>
              <AlertDescription className="break-words">{error}</AlertDescription>
            </Alert>
          ) : null}
          {status ? (
            <Alert variant="success" role="status">
              <CircleCheckIcon />
              <AlertDescription className="status break-all text-foreground">{status}</AlertDescription>
            </Alert>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
