import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: true, // Allow all hosts for ngrok
    port: parseInt(process.env.VITE_DEV_SERVER_PORT || '8081'),
    host: process.env.VITE_DEV_SERVER_HOST || 'localhost',
    open: true,
    hmr: {
      overlay: false, // Disable error overlay to prevent HMR issues
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-i18next', 'i18next'],
  },
});
