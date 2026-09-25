import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  root: "src",
  server: {
    host: "0.0.0.0",
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
