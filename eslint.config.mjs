import nextConfig from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  // Globale ignores VOOR alle andere configs
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "scripts/**",            // CLI-tools (top-level await, geen Next runtime)
      "public/**",
      "prisma/generated/**",
      "next-env.d.ts",
      "*.config.*",
      "coverage/**",
    ],
  },

  // Next.js + TypeScript-eslint + React + a11y + import
  ...nextConfig,
  ...nextCoreWebVitals,

  // Project-specifieke overrides
  {
    rules: {
      // CLAUDE.md sectie 6: geen `any`
      "@typescript-eslint/no-explicit-any": "error",
      // Voorkom console.log in committed code
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // CLAUDE.md sectie 6: ongebruikte vars met _ prefix toegestaan
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // React 19 strict-rules: zijn nieuwe checks, bestaande codebase
      // heeft hier veel pre-existing issues. Downgrade naar warning;
      // refactor naar effect-free patterns is een aparte task.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // Database seed mag console.log (CLI-tool)
  {
    files: ["prisma/seed.ts"],
    rules: {
      "no-console": "off",
    },
  },
];
