import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("vite/preload-helper") || id.includes("commonjsHelpers")) return "vendor-runtime";
          if (!id.includes("node_modules")) return undefined;
          const markdownPackage = id.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(@(?:milkdown|codemirror|lezer)\/[^/]+)/)?.[1];
          if (markdownPackage === "@milkdown/kit") return undefined;
          if (markdownPackage) return `markdown-${markdownPackage.replace(/[@/]/g, "-")}`;
          const shikiAsset = id.match(/node_modules\/@shikijs\/(langs|themes)\/dist\/([^/]+)\.mjs$/);
          if (shikiAsset && shikiAsset[2] !== "index") return `shiki-${shikiAsset[1]}-${shikiAsset[2]}`;
          if (id.includes("/shiki/")) return "markdown-shiki";
          if (id.includes("/katex/")) return "markdown-katex";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/react-router-dom/")) return "vendor-react";
          if (id.includes("/@tanstack/")) return "vendor-query";
          if (id.includes("/lucide-react/")) return "vendor-icons";
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8080",
    },
    allowedHosts: ["xiayh.com.cn"]
  },
});
