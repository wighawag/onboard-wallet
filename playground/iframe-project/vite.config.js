import { defineConfig } from "vite";
// import { viteSingleFile } from "vite-plugin-singlefile";
import sri from "@small-tech/vite-plugin-sri";

export default defineConfig({
  //   plugins: [viteSingleFile()],
  plugins: [sri()],
  build: {
    outDir: "../public/iframe",
    emptyOutDir: true,
  },
  base: ".",
});
