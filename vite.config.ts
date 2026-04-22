import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Force Vite to pre-bundle these up-front so lazy-loaded pages that import them
  // (e.g. Promos/Deals/Dashboard using dayjs) don't trigger a late re-optimize.
  optimizeDeps: {
    include: [
      "dayjs",
      "dayjs/plugin/relativeTime",
      "dayjs/plugin/customParseFormat",
      "dayjs/plugin/advancedFormat",
      "dayjs/plugin/weekOfYear",
      "dayjs/plugin/weekYear",
      "dayjs/plugin/isoWeek",
      "dayjs/plugin/quarterOfYear",
      "dayjs/plugin/localeData",
    ],
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
