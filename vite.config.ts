import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";

// Vite normalizes root to forward slashes. mcp-js 0.24.0 compares it to
// native Windows paths; give only this plugin a native root for its checks.
const mcp = mcpPlugin();
const resolveMcpConfig = mcp.configResolved;
mcp.configResolved = function (config) {
  if (typeof resolveMcpConfig === "function") {
    return resolveMcpConfig.call(this, { ...config, root: resolve(config.root) });
  }
};

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    mcp,
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start", "@tanstack/react-query"],
  },
  server: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: false,
    watch: { ignored: ["**/.output/**", "**/dist/**", "**/android/**"] },
  },
  build: { outDir: ".output/public", sourcemap: false, chunkSizeWarningLimit: 1800 },
});
