import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "**/dist/**",
      "node_modules/**",
      "coverage/**",
      "sbom.cdx.json",
      "**/.next/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/sim/**/*.{ts,tsx}", "apps/web/**/*.{ts,tsx}"],
    plugins: reactHooks.configs.flat.recommended.plugins,
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      // Compiler-oriented rules in hooks v7 want a rewrite of the trainer's
      // refs and round-reset effects. Hook legality and dependency arrays stay enforced.
      "react-hooks/static-components": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/immutability": "off",
      "react-hooks/globals": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/config": "off",
      "react-hooks/gating": "off",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: [
      "apps/mcp/src/**/*.ts",
      "apps/mcp/api/**/*.ts",
      "packages/sim/**/*.{ts,tsx}",
      "apps/web/**/*.{ts,tsx}",
    ],
    rules: {
      "no-console": ["error", { allow: ["error"] }],
    },
  },
  prettier,
);
