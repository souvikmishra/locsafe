export type Route =
  | { name: "connect" }
  | { name: "safe" }
  | { name: "new" }
  | { name: "verify" }
  | { name: "sign" }
  | { name: "export" }
  | { name: "import" }
  | { name: "execute" }
  | { name: "package"; payload: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "") || "/";
  if (path.startsWith("/p/")) {
    return { name: "package", payload: path.slice(3) };
  }
  if (path === "/" || path === "") {
    return { name: "connect" };
  }
  if (path === "/safe") return { name: "safe" };
  if (path === "/tx/new") return { name: "new" };
  if (path === "/tx/verify") return { name: "verify" };
  if (path === "/tx/sign") return { name: "sign" };
  if (path === "/tx/export") return { name: "export" };
  if (path === "/tx/import") return { name: "import" };
  if (path === "/tx/execute") return { name: "execute" };
  return { name: "connect" };
}

export function hrefFor(name: Exclude<Route["name"], "package">): string {
  const map = {
    connect: "#/",
    safe: "#/safe",
    new: "#/tx/new",
    verify: "#/tx/verify",
    sign: "#/tx/sign",
    export: "#/tx/export",
    import: "#/tx/import",
    execute: "#/tx/execute",
  };
  return map[name];
}
