import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { offline } from "../../scripts/vite-offline";

export default defineConfig({
  // The path this app is served under. Add the same prefix to worker/index.js and scripts/build-all.mjs.
  base: "/my-agent-app/",
  // offline(): works offline after the first load (scripts/vite-offline.ts).
  plugins: [react(), tailwindcss(), offline()],
});
