// Which optional features the deploy configuration switches on, checked strictly so a half-done setup fails
// the run instead of going live. Used by scripts/check-features.mjs (CI) and the tests. Never returns values.

import { d1Id } from "./wrangler-config.mjs";

/** Cloudflare's published Turnstile test keys (always pass / always fail / ...): fine locally, never deployed. */
export function isTurnstileTestKey(raw) {
  return /^[123]x0{10,}[A-F]{2}$/.test(String(raw ?? "").trim());
}

/** A real Turnstile site key (0x...) or a test key; "" otherwise. */
export function turnstileSiteKey(raw) {
  const s = String(raw ?? "").trim();
  return /^0x[0-9A-Za-z_-]{10,}$/.test(s) || isTurnstileTestKey(s) ? s : "";
}

/** Whether the build (sitemap) should list /alumni/join: database + public site key present. */
export function joinPageEnabled(env) {
  return d1Id(env.D1_DATABASE_ID) !== "" && turnstileSiteKey(env.TURNSTILE_SITE_KEY) !== "";
}

export const SALT_MIN = 32;

/**
 * { d1, submissions, errors } for a deploy. The alumni form needs all three of TURNSTILE_SITE_KEY,
 * TURNSTILE_SECRET_KEY and SUBMISSION_SALT plus the admin database; any other combination is an error.
 */
export function checkFeatures(env) {
  const errors = [];
  const get = (k) => String(env[k] ?? "").trim();
  const d1Set = get("D1_DATABASE_ID") !== "";
  if (d1Set && !d1Id(get("D1_DATABASE_ID"))) errors.push("D1_DATABASE_ID is not a D1 database id.");
  const d1 = d1Set && errors.length === 0;

  const parts = {
    TURNSTILE_SITE_KEY: get("TURNSTILE_SITE_KEY"),
    TURNSTILE_SECRET_KEY: get("TURNSTILE_SECRET_KEY"),
    SUBMISSION_SALT: get("SUBMISSION_SALT"),
  };
  const set = Object.keys(parts).filter((k) => parts[k] !== "");
  if (set.length > 0 && set.length < 3) {
    const missing = Object.keys(parts).filter((k) => parts[k] === "");
    errors.push(
      `The alumni form is only partly set up: ${missing.join(", ")} missing. Set all three, or none.`,
    );
  }
  if (set.length === 3) {
    if (!d1) errors.push("The alumni form needs the admin database (D1_DATABASE_ID).");
    if (
      isTurnstileTestKey(parts.TURNSTILE_SITE_KEY) ||
      isTurnstileTestKey(parts.TURNSTILE_SECRET_KEY)
    )
      errors.push("A Turnstile test key is set; use the keys of your real Turnstile widget.");
    else {
      if (!turnstileSiteKey(parts.TURNSTILE_SITE_KEY))
        errors.push("TURNSTILE_SITE_KEY does not look like a Turnstile site key (0x...).");
      if (!/^0x[0-9A-Za-z_-]{20,}$/.test(parts.TURNSTILE_SECRET_KEY))
        errors.push("TURNSTILE_SECRET_KEY does not look like a Turnstile secret key (0x...).");
    }
    if (parts.SUBMISSION_SALT.length < SALT_MIN)
      errors.push(`SUBMISSION_SALT must be at least ${SALT_MIN} characters (use a random value).`);
  }
  return { d1, submissions: set.length === 3 && errors.length === 0, errors };
}
