import { defineConfig } from "vite";
import sri from "@small-tech/vite-plugin-sri";
import { outDir } from "./config.js";

export default defineConfig({
  plugins: [sri()],
  build: {
    outDir,
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
  },
  // base: "./",
});
