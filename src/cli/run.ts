import { runCli } from "./main.ts";

const code = await runCli(process.argv.slice(2));
process.exit(code);
