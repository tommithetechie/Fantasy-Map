import { defineConfig } from "vite";

// The project lives on an external volume, where native file events
// often never arrive. Polling keeps the dev server honest.
export default defineConfig({
  server: {
    watch: {
      usePolling: true,
      interval: 250,
    },
  },
});
