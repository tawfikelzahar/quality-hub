import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The SPC calculator runs on the server only (app/api/spc/chart).
  // Pages and components may import its types, never its functions.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["app/api/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "@/lib/spc/calculator", allowTypeImports: true, message: "The calculator runs on the server. Use useChartAnalysis (lib/spc/useChartAnalysis.ts)." },
          { name: "@/lib/spc/engine.server", message: "Server only." },
          { name: "@/lib/spc/nelson", allowTypeImports: true, message: "Rules stay on the server. For test-set labels use @/lib/spc/testSets." },
          { name: "@/lib/stats/normal", allowTypeImports: true, message: "Formulas stay on the server. For p-value text use @/lib/stats/format." },
        ],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
