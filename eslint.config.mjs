import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "src/generated/**", ".data/**", "playwright-report/**", "test-results/**"],
  },
  {
    // UI must go through services and API routes, never Prisma directly.
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/generated/prisma/client", "@/lib/db/*", "@/modules/*/service"],
              message: "Components must not access the database or services directly.",
            },
          ],
        },
      ],
    },
  },
  {
    // Pages may call services (which enforce ownership) but never Prisma directly.
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/generated/prisma/client"], message: "Use a module service instead of Prisma." }] },
      ],
    },
  },
];

export default config;
