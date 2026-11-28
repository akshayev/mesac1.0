/**
 * Compile-time flag set by vite.config.ts (see scripts/lib/build-flags.mjs). It is `false` in every normal
 * build, so the local-development login shortcut (dev-bypass.ts) is removed from production output.
 * The Node tests set globalThis.__MESAC_DEV_ADMIN__ themselves.
 */
declare const __MESAC_DEV_ADMIN__: boolean;
