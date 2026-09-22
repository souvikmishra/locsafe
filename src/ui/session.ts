import type { SignedTxPackage } from "../domain/types.ts";
import type { SafeSnapshot } from "../rpc/safe.ts";

const KEY = "locsafe-session";

export type Session = {
  rpcUrl: string;
  safeAddress: `0x${string}`;
  snapshot?: SafeSnapshot;
  pkg?: SignedTxPackage;
};

function revive(session: Session): Session {
  if (session.snapshot) {
    session.snapshot = {
      ...session.snapshot,
      nonce: BigInt(session.snapshot.nonce),
      balance: BigInt(session.snapshot.balance),
    };
  }
  return session;
}

export function loadSession(): Session | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) {
    return null;
  }
  return revive(JSON.parse(raw) as Session);
}

export function saveSession(session: Session): void {
  sessionStorage.setItem(
    KEY,
    JSON.stringify(session, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}

export function isDevChainAllowed(): boolean {
  return (
    typeof localStorage !== "undefined" &&
    localStorage.getItem("E2E_MODE") === "true"
  );
}
