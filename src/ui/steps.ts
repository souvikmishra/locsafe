import type { RouteName } from "./router.ts";
import type { Session } from "./session.ts";

export type StepId = "connect" | "create" | "review" | "sign" | "share" | "execute";

export type Step = {
  id: StepId;
  number: number;
  title: string;
  /** One line shown in the rail and at the top of the screen. */
  hint: string;
  /** Longer explanation shown on the home page. */
  detail: string;
  routes: RouteName[];
  href: RouteName;
};

export const STEPS: Step[] = [
  {
    id: "connect",
    number: 1,
    title: "Connect your Safe",
    hint: "Paste an Ethereum RPC URL and your Safe address.",
    detail:
      "locsafe reads the owners, threshold and nonce straight from the chain. Your RPC is the only thing it talks to.",
    routes: ["connect", "safe"],
    href: "connect",
  },
  {
    id: "create",
    number: 2,
    title: "Create or import",
    hint: "Build a new transaction, or open one you were sent.",
    detail:
      "Proposers fill in a transfer, owner change or contract call. Co-signers open the .locsafe.json file or link from the previous signer; its signatures are checked against the Safe's owners.",
    routes: ["new", "import"],
    href: "new",
  },
  {
    id: "review",
    number: 3,
    title: "Review",
    hint: "Check what the transaction does and note its hashes.",
    detail:
      "Calldata is decoded offline and the domain hash, message hash and safeTxHash are recomputed locally. Anything that can't be decoded is marked UNVERIFIED: stop and ask.",
    routes: ["verify"],
    href: "verify",
  },
  {
    id: "sign",
    number: 4,
    title: "Sign on your device",
    hint: "Match the hashes on your Ledger or Trezor, then approve.",
    detail:
      "Your hardware wallet shows the domain hash and message hash. Approve only if they match what you see here and in an independent hash tool.",
    routes: ["sign"],
    href: "sign",
  },
  {
    id: "share",
    number: 5,
    title: "Share",
    hint: "Send the signed file or link to the next owner.",
    detail:
      "Download the updated .locsafe.json or copy a share link, and send it to the next owner over any channel you trust. No server is involved.",
    routes: ["export"],
    href: "export",
  },
  {
    id: "execute",
    number: 6,
    title: "Execute",
    hint: "Once enough owners have signed, broadcast it.",
    detail:
      "Anyone with a hardware wallet and a little ETH for gas can submit the fully signed transaction through the same RPC.",
    routes: ["execute"],
    href: "execute",
  },
];

export function stepForRoute(route: RouteName): Step | undefined {
  return STEPS.find((step) => step.routes.includes(route));
}

export type StepState = "done" | "ready" | "todo";

export function stepState(step: StepId, session: Session | null): StepState {
  const signatures = session?.pkg?.signatures.length ?? 0;
  switch (step) {
    case "connect":
      return session?.snapshot ? "done" : "todo";
    case "create":
      return session?.pkg ? "done" : "todo";
    case "review":
    case "sign":
      return signatures > 0 ? "done" : "todo";
    case "share":
      return "todo";
    case "execute":
      return isThresholdMet(session) ? "ready" : "todo";
  }
}

export function isThresholdMet(session: Session | null): boolean {
  const threshold = session?.snapshot?.threshold;
  return threshold !== undefined && (session?.pkg?.signatures.length ?? 0) >= threshold;
}

/**
 * Signatures are validated whenever a package is paired with an on-chain
 * snapshot of the same Safe; without one they are unchecked.
 */
export function isPackageValidated(session: Session | null): boolean {
  const { snapshot, pkg } = session ?? {};
  return !!snapshot && !!pkg && snapshot.address.toLowerCase() === pkg.safeAddress.toLowerCase();
}
