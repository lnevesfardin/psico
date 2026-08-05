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
    // Plugin de terceiro (Vellum/Originkit) baixado solto na raiz: não é
    // código da aplicação e não segue as regras daqui.
    "originkit-main/**",
  ]),
]);

export default eslintConfig;
