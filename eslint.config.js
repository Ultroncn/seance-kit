import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "coverage/**", "playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["worker/**/*.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: [
      "scripts/**/*.mjs",
      "*.js",
      "**/vite.config.ts",
      "playwright.config.ts",
      "vitest.config.ts",
    ],
    languageOptions: { globals: { ...globals.node } },
  },
);
