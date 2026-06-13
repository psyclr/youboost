import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Size/complexity budget — ratchet: tighten as the biggest files shrink,
  // never loosen. Counts skip blanks/comments.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        { max: 450, skipBlankLines: true, skipComments: true },
      ],
      // Warn-level: 14 existing pages sit between 13 and 26 (JSX
      // conditional rendering inflates cyclomatic complexity). Treat as a
      // ratchet — don't push existing numbers up, aim down when touching.
      complexity: ["warn", 12],
    },
  },
  {
    // Data/declaration-heavy modules: prose content and the API type
    // catalogue grow line-wise without growing complexity-wise.
    files: ["src/content/**", "src/lib/api/types.ts"],
    rules: {
      "max-lines": "off",
    },
  },
  {
    files: ["src/**/__tests__/**", "e2e/**"],
    rules: {
      "max-lines": "off",
      complexity: "off",
    },
  },
]);

export default eslintConfig;
