import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  // Dev only: mirror the deployed layout (/, /archive/, /inbox/ on one origin)
  // by forwarding app paths to their own dev servers. ws carries Vite HMR.
  server: {
    proxy: {
      "^/archive(/|$)": { target: "http://localhost:5174", ws: true },
      "^/inbox(/|$)": { target: "http://localhost:5175", ws: true },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        kit: resolve(import.meta.dirname, "kit/index.html"),
      },
    },
  },
});
