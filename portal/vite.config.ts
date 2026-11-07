import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0, sourcemap: false },
  server: { port: 5173, proxy: { "/api": "http://localhost:3000" } },
});
