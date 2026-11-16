// Run: pnpm --filter @seance/inbox-exorcist mcp -- --data .local-data/inbox [--import file]
import { resolve } from "node:path";
import { runCli } from "@seance/mcp-server";
import { inboxMcp } from "./app";

// Relative paths in the Kiro config resolve against the repo root, whatever the launch directory.
void runCli(inboxMcp, process.argv.slice(2), resolve(import.meta.dirname, "../../.."));
