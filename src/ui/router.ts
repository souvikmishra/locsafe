export type Route =
  | { name: "home" }
  | { name: "connect" }
  | { name: "safe" }
  | { name: "new" }
  | { name: "verify" }
  | { name: "sign" }
  | { name: "export" }
  | { name: "import" }
  | { name: "execute" }
  | { name: "package"; payload: string };

export type RouteName = Exclude<Route["name"], "package">;

const PATHS: Record<RouteName, string> = {
  home: "/",
  connect: "/connect",
  safe: "/safe",
  new: "/tx/new",
  verify: "/tx/verify",
  sign: "/tx/sign",
  export: "/tx/export",
  import: "/tx/import",
  execute: "/tx/execute",
};

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "") || "/";
  if (path.startsWith("/p/")) {
    return { name: "package", payload: path.slice(3) };
  }
  const match = (Object.keys(PATHS) as RouteName[]).find((name) => PATHS[name] === path);
  return { name: match ?? "home" };
}

export function hrefFor(name: RouteName): string {
  return `#${PATHS[name]}`;
}

export function goTo(name: RouteName): void {
  window.location.hash = hrefFor(name);
}

/** Navigate without leaving a history entry (e.g. away from a #/p/ import link). */
export function replaceRoute(name: RouteName): void {
  window.location.replace(hrefFor(name));
}
