import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@supabase/")) return "supabase";
          if (id.includes("node_modules/recharts/")) return "charts";
          if (id.includes("node_modules/d3-") || id.includes("node_modules/victory-vendor/")) return "chart-vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
