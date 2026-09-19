import { describe, expect, it } from "vitest";
import { trezorInitOptions } from "./trezor.ts";
import { assertNoVendorFetch } from "./types.ts";

describe("Trezor bundling", () => {
  it("initializes against same-origin connectSrc and WebUSB only", () => {
    const opts = trezorInitOptions("./trezor/");
    expect(opts.connectSrc).toBe("./trezor/");
    expect(opts.transports).toEqual(["WebUsbTransport"]);
    expect(opts.popup).toBe(false);
  });

  it("blocks connect.trezor.io", () => {
    expect(() => assertNoVendorFetch("https://connect.trezor.io/9/")).toThrow(
      /vendor fetch blocked/,
    );
  });
});
