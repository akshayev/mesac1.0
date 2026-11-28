#!/usr/bin/env node
// First step of the deploy (and backup) workflow: which optional features are configured, and is each one
// complete?
//   admin dashboard        D1_DATABASE_ID (secret)
//   alumni form            TURNSTILE_SITE_KEY (variable) + TURNSTILE_SECRET_KEY + SUBMISSION_SALT (secrets)
//   papers refresh button  PAPERS_REFRESH_TOKEN (secret)
// Fails on a partial or invalid setup. Writes d1=, submissions= and refresh= (true|false) to $GITHUB_OUTPUT.
// --d1-only (backup workflow): checks and writes only d1=. Prints names, never values.

import { appendFileSync } from "node:fs";
import { checkFeatures } from "./lib/features.mjs";

const d1Only = process.argv.includes("--d1-only");
const { d1, submissions, refresh, errors } = checkFeatures(
  d1Only ? { D1_DATABASE_ID: process.env.D1_DATABASE_ID } : process.env,
);
console.log(
  d1Only
    ? `features: admin database ${d1 ? "on" : "off"}`
    : `features: admin dashboard ${d1 ? "on" : "off"}, alumni form ${submissions ? "on" : "off"}, papers refresh button ${refresh ? "on" : "off"}`,
);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    d1Only ? `d1=${d1}\n` : `d1=${d1}\nsubmissions=${submissions}\nrefresh=${refresh}\n`,
  );
}
if (errors.length) {
  for (const e of errors) console.error(`features: ${e}`);
  process.exit(1);
}
