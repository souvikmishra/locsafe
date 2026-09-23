import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const here = dirname(fileURLToPath(import.meta.url));
const stub = join(here, "src/hw/empty.ts");

function optionalVendor(pkg: string): Record<string, string> {
  if (existsSync(join(here, "node_modules", pkg))) {
    return {};
  }
  return { [pkg]: stub };
}

// Vite dev injects CSS as <style> and plugin-react adds an inline preamble;
// the production CSP blocks both, so drop the meta tag while serving only.
const devWithoutCsp: Plugin = {
  name: "locsafe-dev-without-csp",
  apply: "serve",
  transformIndexHtml: (html) =>
    html.replace(/\s*<meta\s+http-equiv="Content-Security-Policy"[^>]*>/, ""),
};

const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
const buildId =
  process.env.VITE_BUILD_ID ??
  (sourceDateEpoch ? `epoch-${sourceDateEpoch}` : "dev");

export default defineConfig({
  plugins: [react(), tailwindcss(), devWithoutCsp],
  base: "./",
  define: {
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      ...optionalVendor("@ledgerhq/hw-transport-webhid"),
      ...optionalVendor("@ledgerhq/hw-app-eth"),
      ...optionalVendor("@trezor/connect"),
    },
  },
  build: {
    sourcemap: true,
    cssCodeSplit: false,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
  },
});
