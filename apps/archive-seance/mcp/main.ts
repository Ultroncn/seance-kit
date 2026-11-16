// Run: pnpm --filter @seance/archive-seance mcp -- --data .local-data/archive [--import file]
import { resolve } from "node:path";
import { runCli } from "@seance/mcp-server";
import { archiveMcp } from "./app";

// Relative paths in the Kiro config resolve against the repo root, whatever the launch directory.
void runCli(archiveMcp, process.argv.slice(2), resolve(import.meta.dirname, "../../.."));
