import { MemoryStorage } from "../src/memory";
import { runStorageContract } from "./contract";

runStorageContract("MemoryStorage", () => new MemoryStorage(), undefined, { numRuns: 100 });
