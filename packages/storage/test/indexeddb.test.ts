import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { IndexedDbStorage } from "../src/indexeddb";
import { runStorageContract } from "./contract";

let n = 0;

runStorageContract(
  "IndexedDbStorage (fake-indexeddb)",
  // A fresh IDBFactory per test gives a clean database with no shared state.
  () => new IndexedDbStorage({ name: `test-${n++}`, indexedDB: new IDBFactory(), IDBKeyRange }),
  (s) => (s as IndexedDbStorage).close(),
);
