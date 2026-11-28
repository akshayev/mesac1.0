// Compile-time flags for vite.config.ts (also used by the tests that prove production builds are clean).
//
// MESAC_DEV_ADMIN_BUILD=1 is set only by `npm run dev:admin`. It turns on the local login shortcut
// (src/server/dev-bypass.ts) and sends the build to .output-dev, so the real deploy output (.output) never
// contains it. Every other build gets `false`, and the bundler removes the shortcut code completely.

export function isDevAdminBuild(env = process.env) {
  return env.MESAC_DEV_ADMIN_BUILD === "1";
}

/** Values for Vite's `define`. */
export function buildDefines(env = process.env) {
  return { __MESAC_DEV_ADMIN__: JSON.stringify(isDevAdminBuild(env)) };
}

/** nitro output folder: .output for real builds, .output-dev for dev:admin builds. */
export function outputDir(env = process.env) {
  return isDevAdminBuild(env) ? ".output-dev" : ".output";
}
