#!/usr/bin/env node
// Builds public/og-image.jpg (1200x630, the picture shown when a link is shared) from existing images:
// the home-page hero photo darkened as a background, with the MESAC logo in a white circle on top.
// Run `node scripts/make-og-image.mjs` again if the logo or hero photo changes.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const W = 1200;
const H = 630;
const LOGO = 440;

const background = await sharp(join(ROOT, "public/images/home/hero.jpg"))
  .resize(W, H, { fit: "cover", position: "centre" })
  .blur(2)
  .modulate({ brightness: 0.45 })
  .toBuffer();

const circle = Buffer.from(
  `<svg width="${LOGO}" height="${LOGO}"><circle cx="${LOGO / 2}" cy="${LOGO / 2}" r="${LOGO / 2}"/></svg>`,
);
// The logo file has a lot of white margin; crop to the round emblem first.
const logo = await sharp(join(ROOT, "public/mesac-logo-real.png"))
  .extract({ left: 190, top: 90, width: 740, height: 740 })
  .resize(LOGO, LOGO)
  .composite([{ input: circle, blend: "dest-in" }])
  .png()
  .toBuffer();

const ring = Buffer.from(
  `<svg width="${LOGO + 24}" height="${LOGO + 24}"><circle cx="${(LOGO + 24) / 2}" cy="${(LOGO + 24) / 2}" r="${(LOGO + 24) / 2}" fill="#e8b84a"/></svg>`,
);

await sharp(background)
  .composite([
    { input: ring, left: Math.round((W - LOGO - 24) / 2), top: Math.round((H - LOGO - 24) / 2) },
    { input: logo, left: Math.round((W - LOGO) / 2), top: Math.round((H - LOGO) / 2) },
  ])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(join(ROOT, "public/og-image.jpg"));

console.log("make-og-image: wrote public/og-image.jpg (1200x630)");
