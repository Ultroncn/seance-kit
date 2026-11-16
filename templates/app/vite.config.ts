import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // The path this app is served under. Add the same prefix to worker/index.js and scripts/build-all.mjs.
  base: "/my-agent-app/",
  plugins: [react(), tailwindcss()],
});
