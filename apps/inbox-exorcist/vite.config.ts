import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { offline } from "../../scripts/vite-offline";

export default defineConfig({
  base: "/inbox/",
  // offline(): works offline after the first load (scripts/vite-offline.ts).
  plugins: [react(), tailwindcss(), offline()],
});
