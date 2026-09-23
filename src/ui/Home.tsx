import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  FileInputIcon,
  LockIcon,
  NetworkIcon,
  OctagonAlertIcon,
  PlusIcon,
  UsbIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "../components/ui/badge.tsx";
import { buttonVariants } from "../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Brand } from "./AppShell.tsx";
import { hrefFor, type RouteName } from "./router.ts";
import type { Session } from "./session.ts";
import { STEPS } from "./steps.ts";

const EXAMPLE_HASH = "0x8f3a91c2d7e04b6a15f9c3e82d70a4b1e6c95f0d3a7b28e41c6d9f05a2b7e3d1";

const TRUST = [
  {
    icon: <NetworkIcon />,
    title: "Only your RPC",
    text: "No Safe servers, accounts, analytics or trackers. The only connection is the RPC you choose.",
  },
  {
    icon: <LockIcon />,
    title: "Hashes computed locally",
    text: "Rebuilt from the Safe's on-chain state and the transaction details, on your machine.",
  },
  {
    icon: <UsbIcon />,
    title: "Ledger & Trezor",
    text: "You approve on the device only after matching the hashes it shows.",
  },
];

const CHECKLIST = [
  "A Ledger or Trezor with the Ethereum app installed. On Ledger, turn on Blind signing in the Ethereum app's settings.",
  "An Ethereum Mainnet JSON-RPC URL: your own node or a provider you trust.",
  "Your Safe's address.",
  "Co-signing or executing? The .locsafe.json file or link the previous owner sent you.",
];

const ROLES: { title: string; text: string; steps: number[]; cta: string; href: RouteName }[] = [
  {
    title: "Proposer",
    text: "You're starting a new transaction.",
    steps: [1, 2, 3, 4, 5],
    cta: "Start a transaction",
    href: "connect",
  },
  {
    title: "Co-signer",
    text: "Another owner sent you a file or link to sign.",
    steps: [2, 3, 4, 5],
    cta: "Open what I received",
    href: "import",
  },
  {
    title: "Executor",
    text: "Enough owners have signed and it's ready to go on-chain.",
    steps: [2, 3, 6],
    cta: "Open what I received",
    href: "import",
  },
];

const RULES = [
  "The domain hash and message hash on your device must match this app character for character.",
  "Cross-check them with an independent tool: pnpm locsafe-hash from this repository, or pcaversaccio's safe-tx-hashes-util.",
  "If the calldata is marked UNVERIFIED, or it's a delegatecall you didn't expect, stop and ask the proposer.",
  "Your browser's network panel should only ever show requests to your RPC.",
];

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6">
      <div className="grid gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description ? <p className="max-w-2xl text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function HashMatchIllustration() {
  const hashLines = (
    <code className="block font-mono text-xs leading-relaxed break-all">{EXAMPLE_HASH}</code>
  );
  return (
    <Card className="gap-4" aria-label="Example: compare the hash on screen with the hash on your device">
      <CardHeader>
        <CardTitle>What you check before approving</CardTitle>
        <CardDescription>Example message hash</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5 rounded-lg border bg-muted/60 p-3">
          <span className="text-xs font-medium text-muted-foreground">On this screen</span>
          {hashLines}
        </div>
        <div className="grid gap-1.5 rounded-xl border-4 border-neutral-800 bg-neutral-950 p-3 text-neutral-100 shadow-inner">
          <span className="text-xs font-medium text-neutral-400">On your Ledger / Trezor</span>
          {hashLines}
        </div>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Badge variant="success">
          <CheckIcon />
          Identical: approve
        </Badge>
        <Badge variant="outline" className="text-destructive">
          <XIcon />
          Any difference: reject
        </Badge>
      </CardFooter>
    </Card>
  );
}

export function Home({ session }: { session: Session | null }) {
  const appHref = hrefFor(session?.pkg ? "verify" : session?.snapshot ? "safe" : "connect");
  const buildId = String(import.meta.env.VITE_BUILD_ID ?? "dev");
  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Brand />
          <a href={appHref} className={buttonVariants({ size: "sm", className: "ml-auto" })}>
            Open app
            <ArrowRightIcon />
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-20 px-4 py-12 md:py-20">
        <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-6">
            <Badge variant="outline" className="text-muted-foreground">
              Local-first · Ethereum Mainnet · Safe v1.3.0 &amp; v1.4.1
            </Badge>
            <h2 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
              Sign Safe transactions with only an RPC and a hardware wallet
            </h2>
            <p className="max-w-xl text-lg text-muted-foreground">
              Build, check, sign and execute Safe multisig transactions without the Safe{"{"}Wallet
              {"}"} app or its servers. Everything is computed in your browser, and signatures travel
              between owners as ordinary files or links.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={hrefFor("connect")} className={buttonVariants({ size: "lg" })}>
                <PlusIcon />
                Start a new transaction
              </a>
              <a href={hrefFor("import")} className={buttonVariants({ size: "lg", variant: "outline" })}>
                <FileInputIcon />
                I received a transaction
              </a>
            </div>
          </div>
          <HashMatchIllustration />
        </section>

        <ul className="grid gap-4 md:grid-cols-3">
          {TRUST.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:size-4">
                {item.icon}
              </span>
              <span className="grid gap-1">
                <span className="font-medium">{item.title}</span>
                <span className="text-sm text-muted-foreground">{item.text}</span>
              </span>
            </li>
          ))}
        </ul>

        <Section title="Before you start" description="Have these ready. Nothing needs to be installed.">
          <Card>
            <CardContent>
              <ul className="grid gap-4 md:grid-cols-2">
                {CHECKLIST.map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Section>

        <Section
          title="How it works"
          description="The app walks you through six steps. Each owner only does the ones for their role."
        >
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.id}>
                <Card className="h-full gap-3">
                  <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-3">
                    <span className="row-span-2 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {step.number}
                    </span>
                    <h3 className="font-semibold">{step.title}</h3>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{step.detail}</CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Which one are you?">
          <div className="grid gap-4 md:grid-cols-3">
            {ROLES.map((role) => (
              <Card key={role.title} className="gap-4">
                <CardHeader>
                  <CardTitle>{role.title}</CardTitle>
                  <CardDescription>{role.text}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  Steps
                  {role.steps.map((n) => (
                    <Badge key={n} variant="secondary" title={STEPS[n - 1].title}>
                      {n}
                    </Badge>
                  ))}
                </CardContent>
                <CardFooter className="mt-auto">
                  <a href={hrefFor(role.href)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    {role.cta}
                    <ArrowRightIcon />
                  </a>
                </CardFooter>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="Before you approve anything">
          <Card className="border-warning/40 bg-warning/5">
            <CardContent>
              <ol className="grid gap-4 md:grid-cols-2">
                {RULES.map((rule) => (
                  <li key={rule} className="flex gap-3 text-sm">
                    <OctagonAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                    {rule}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </Section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-xs text-muted-foreground">
          <span>MIT licensed · Runs entirely in your browser</span>
          <span className="font-mono">build {buildId}</span>
        </div>
      </footer>
    </div>
  );
}
