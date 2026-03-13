import { defineConfig } from "tsdown";

export default defineConfig([
  {
    clean: true,
    cjsDefault: false,
    dts: true,
    entry: {
      index: "src/index.ts"
    },
    format: ["esm", "cjs"],
    outExtension({ format }) {
      return {
        js: format === "cjs" ? ".cjs" : ".js"
      };
    },
    outDir: "dist",
    sourcemap: true,
    target: "node18"
  },
  {
    banner: {
      js: "#!/usr/bin/env node"
    },
    clean: false,
    dts: false,
    entry: {
      cli: "src/cli/index.ts"
    },
    format: ["cjs"],
    outExtension() {
      return {
        js: ".cjs"
      };
    },
    outDir: "dist",
    sourcemap: true,
    target: "node18"
  }
]);
