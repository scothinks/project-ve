import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: ["output/**", "scrollcraft/**", ".next/**", ".next-e2e/**", "next-env.d.ts", "test-results/**", "playwright-report/**", "supabase/.temp/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Standalone design-preview verification scripts run directly as CommonJS.
    files: ["scrollcraft/**/lab/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default eslintConfig;
