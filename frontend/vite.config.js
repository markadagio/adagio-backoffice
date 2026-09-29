import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the SPA runs on 5173 and the API on 3000; in production
// Flask serves the built files itself, so every path stays relative and
// nothing needs to know an origin.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
