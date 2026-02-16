import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        '/api/cricbuzz': {
          target: 'https://cricbuzz-cricket.p.rapidapi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/cricbuzz/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Add RapidAPI headers for all requests including images
              proxyReq.setHeader('x-rapidapi-key', env.VITE_RAPIDAPI_KEY || '');
              proxyReq.setHeader('x-rapidapi-host', 'cricbuzz-cricket.p.rapidapi.com');
            });
          },
        },
      },
    },
    define: {
      'import.meta.env.VITE_USE_LIVE_API': JSON.stringify(process.env.VITE_USE_LIVE_API || ''),
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
