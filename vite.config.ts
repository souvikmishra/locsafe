import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = dirname(fileURLToPath(import.meta.url));
const stub = join(here, "src/hw/empty.ts");

function optionalVendor(pkg: string): Record<string, string> {
  if (existsSync(join(here, "node_modules", pkg))) {
    return {};
  }
  return { [pkg]: stub };
}

const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
const buildId =
  process.env.VITE_BUILD_ID ??
  (sourceDateEpoch ? `epoch-${sourceDateEpoch}` : "dev");

export default defineConfig({
  plugins: [react()],
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
