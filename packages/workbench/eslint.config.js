import js from "@eslint/js";
import tseslint from "typescript-eslint";
import lit from "eslint-plugin-lit";
import litA11y from "eslint-plugin-lit-a11y";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "**/*.config.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },
  {
    files: ["src/**/*.ts"],
    plugins: { lit, "lit-a11y": litA11y },
    rules: {
      ...lit.configs.recommended.rules,
      ...litA11y.configs.recommended.rules,
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
    }
  }
);
