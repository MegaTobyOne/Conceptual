import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import pkg from "./package.json" with { type: "json" };

// Relative base so the same build works at / locally and under /workbench/ when deployed.
const base = process.env.PSPF_BASE ?? "./";

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  resolve: {
    alias: {
      "@pspf/contracts": fileURLToPath(new URL("../contracts/dist/index.js", import.meta.url))
    }
  },
  build: {
    target: "es2022",
    sourcemap: true
  },
  server: {
    port: 5174,
    strictPort: true
  }
});
