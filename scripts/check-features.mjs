#!/usr/bin/env node
// First step of the deploy workflow: which optional features are configured, and is each one complete?
//   admin dashboard   D1_DATABASE_ID (secret)
//   alumni form       TURNSTILE_SITE_KEY (variable) + TURNSTILE_SECRET_KEY + SUBMISSION_SALT (secrets)
// Fails on a partial or invalid setup. Writes d1=true|false and submissions=true|false to $GITHUB_OUTPUT.
// Prints names, never values.

import { appendFileSync } from "node:fs";
import { checkFeatures } from "./lib/features.mjs";

const { d1, submissions, errors } = checkFeatures(process.env);
console.log(
  `features: admin dashboard ${d1 ? "on" : "off"}, alumni form ${submissions ? "on" : "off"}`,
);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `d1=${d1}\nsubmissions=${submissions}\n`);
}
if (errors.length) {
  for (const e of errors) console.error(`features: ${e}`);
  process.exit(1);
}
