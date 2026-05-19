// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.tmp/**",
      "**/coverage/**",
      "debug-workspace/**",
      "schemas/**",
      "packages/explorer/dist/**",
      "packages/reference-data/src/generated/**",
      "packages/reference-data/data/**",
      "packages/contracts/test-fixtures/**",
      "**/*.tsbuildinfo"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"]
  })),
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module"
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" }
      ],
      "no-console": "off",
      eqeqeq: ["error", "smart"],
      "prefer-const": "warn"
    }
  },
  {
    // Loosen rules for legacy monolithic extension entry points until they are split.
    files: ["packages/workshop/src/extension.ts", "packages/shop/src/extension.ts", "packages/core/src/service.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        Buffer: "readonly",
        fetch: "readonly",
        __dirname: "readonly",
        __filename: "readonly"
      }
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    // Scripts that evaluate code inside a Playwright browser context need browser globals.
    files: [
      "scripts/check-explorer-publication.mjs",
      "scripts/check-explorer-local-authoring.mjs",
      "scripts/check-explorer-to-workshop-import.mjs",
      "scripts/check-core-sqljs-runtime.mjs",
      "scripts/check-accessibility.mjs"
    ],
    languageOptions: {
      globals: {
        document: "readonly",
        window: "readonly",
        getComputedStyle: "readonly",
        requestAnimationFrame: "readonly",
        localStorage: "readonly",
        indexedDB: "readonly",
        Event: "readonly",
        Node: "readonly",
        HTMLInputElement: "readonly",
        HTMLDetailsElement: "readonly"
      }
    }
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
