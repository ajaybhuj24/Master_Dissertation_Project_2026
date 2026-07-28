import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI backend so the frontend can use
    // same-origin relative paths (/api/...) in dev without CORS config.
    // The backend mounts its routes at root (/upload, /paper/current, ...),
    // so we strip the /api prefix on the way through.
    proxy: {
      "/api": {
        // 127.0.0.1, not "localhost": Node resolves localhost to IPv6 ::1,
        // but uvicorn binds IPv4 127.0.0.1 by default — the mismatch would
        // make the proxy ECONNREFUSED even with the backend running.
        // VITE_API_TARGET overrides the backend for testing against a
        // secondary instance (e.g. VITE_API_TARGET=http://127.0.0.1:8001).
        target: process.env.VITE_API_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
})
