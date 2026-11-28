import { defineConfig, loadEnv, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Shared with the tests that check production builds (scripts/lib/build-flags.mjs).
import { buildDefines, isDevAdminBuild, outputDir } from "./scripts/lib/build-flags.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface RollupWarningLike {
  code?: string;
  message?: string;
  [key: string]: unknown;
}

type RollupWarnHandler = (warning: RollupWarningLike) => void;

export default defineConfig(({ command, mode }) => ({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
    }),
    command === "build"
      ? (nitro({
          preset: "cloudflare-module",
          output: {
            dir: outputDir(),
            serverDir: `${outputDir()}/server`,
            publicDir: `${outputDir()}/public`,
          },
          cloudflare: {
            nodeCompat: true,
            // A dev:admin build must never become what `wrangler deploy` picks up.
            deployConfig: !isDevAdminBuild(),
          },
          hooks: {
            "rollup:before"(
              _nitro: unknown,
              config: { onwarn?: (warning: RollupWarningLike, warn: RollupWarnHandler) => void },
            ) {
              const originalOnwarn = config.onwarn;
              config.onwarn = (warning: RollupWarningLike, warn: RollupWarnHandler) => {
                if (
                  warning?.code === "MODULE_LEVEL_DIRECTIVE" ||
                  warning?.message?.includes("MODULE_LEVEL_DIRECTIVE") ||
                  warning?.message?.includes("use client")
                ) {
                  return;
                }
                if (originalOnwarn) {
                  originalOnwarn(warning, warn);
                } else if (warn) {
                  warn(warning);
                }
              };
            },
          },
        }) as unknown as Plugin)
      : null,
    viteReact(),
  ].filter(Boolean) as Plugin[],
  // Expose exactly SITE_URL (public address, used for canonical links) to the app, from the environment or
  // .env. A define, not an envPrefix: a "SITE_URL" prefix would also expose any variable whose name starts
  // with SITE_URL. Other variables reach the browser only with the default VITE_ prefix.
  define: {
    "import.meta.env.SITE_URL": JSON.stringify(loadEnv(mode, __dirname, "").SITE_URL ?? ""),
    // __MESAC_DEV_ADMIN__: false in every normal build, so the local login shortcut is removed.
    ...buildDefines(),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" ||
          warning.message?.includes("MODULE_LEVEL_DIRECTIVE") ||
          warning.message?.includes("use client")
        ) {
          return;
        }
        defaultHandler(warning);
      },
    },
  },
}));
