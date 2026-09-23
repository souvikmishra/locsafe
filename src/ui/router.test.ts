import { describe, expect, it } from "vitest";
import { hrefFor, parseHash } from "./router.ts";

describe("hash routes", () => {
  it("parses share links and screen paths", () => {
    expect(parseHash("#/")).toEqual({ name: "home" });
    expect(parseHash("")).toEqual({ name: "home" });
    expect(parseHash("#/connect")).toEqual({ name: "connect" });
    expect(parseHash("#/safe")).toEqual({ name: "safe" });
    expect(parseHash("#/tx/new")).toEqual({ name: "new" });
    expect(parseHash("#/tx/execute")).toEqual({ name: "execute" });
    expect(parseHash("#/p/abc")).toEqual({ name: "package", payload: "abc" });
  });

  it("falls back to home for unknown paths", () => {
    expect(parseHash("#/nope")).toEqual({ name: "home" });
  });

  it("round-trips hrefs", () => {
    expect(parseHash(hrefFor("verify"))).toEqual({ name: "verify" });
    expect(hrefFor("home")).toBe("#/");
  });
});
