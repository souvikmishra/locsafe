import { describe, expect, it } from "vitest";
import { parseHash } from "./router.ts";

describe("hash routes", () => {
  it("parses share links and screen paths", () => {
    expect(parseHash("#/")).toEqual({ name: "connect" });
    expect(parseHash("#/safe")).toEqual({ name: "safe" });
    expect(parseHash("#/tx/new")).toEqual({ name: "new" });
    expect(parseHash("#/p/abc")).toEqual({ name: "package", payload: "abc" });
  });
});
