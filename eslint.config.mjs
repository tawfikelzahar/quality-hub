import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Calculations and the report interpretation run on the server only.
  // Pages, components and client libraries may import their types, never their functions.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["app/api/**", "lib/**/*.server.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "@/lib/spc/calculator", allowTypeImports: true, message: "The calculator runs on the server. Use useChartAnalysis (lib/spc/useChartAnalysis.ts)." },
          { name: "@/lib/spc/engine.server", message: "Server only." },
          { name: "@/lib/spc/reportText.server", message: "Server only." },
          { name: "@/lib/oee/insight.server", message: "Server only (/api/oee/insight, Pro)." },
          { name: "@/lib/aql/calculator", allowTypeImports: true, message: "AQL plans come from /api/aql. For choices and reply types use @/lib/aql/options." },
          { name: "@/lib/icmsf/calculator", allowTypeImports: true, message: "ICMSF plans and risk curves come from /api/icmsf. Use @/lib/icmsf/options." },
          { name: "@/lib/icmsf/tables", allowTypeImports: true, message: "Table 6-1 stays on the server (/api/icmsf). Use @/lib/icmsf/options." },
          { name: "@/lib/aql/tables", allowTypeImports: true, message: "The verified ISO tables stay on the server (/api/aql). Use @/lib/aql/options." },
          { name: "@/lib/spc/reportInterpretation", allowTypeImports: true, message: "The interpretation runs on the server (lib/spc/reportText.server.ts, /api/spc/report-text)." },
          { name: "@/lib/spc/capabilityReason", allowTypeImports: true, message: "The verdict reason is written on the server and arrives with the result." },
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
