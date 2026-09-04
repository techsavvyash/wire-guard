import { defineConfig } from "tsup"

export default defineConfig({
  clean: true,
  dts: false,
  entry: ["src/index.ts"],
  external: ["vite"],
  format: ["esm"],
  sourcemap: true,
  splitting: false,
  target: "es2022"
})
