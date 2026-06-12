import { fixupConfigRules } from "@eslint/compat"
import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier"

const eslintConfig = defineConfig([
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTs),
  // Disable ESLint rules that conflict with Prettier formatting. Keep last.
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".agents/**"]),
])

export default eslintConfig
