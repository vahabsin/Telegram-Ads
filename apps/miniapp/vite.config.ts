import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Read the monorepo's single root .env instead of requiring a separate apps/miniapp/.env.
  envDir: "../../",
  server: {
    port: 5173,
  },
});
