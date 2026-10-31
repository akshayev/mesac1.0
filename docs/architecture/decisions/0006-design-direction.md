# ADR-0006: Professional, restrained maroon and gold design
Status: Accepted; implementation incomplete
Date: 2026-10-02 (proposal)

## Decision
Calm layouts, deep maroon primary, gold as a small accent, off-white/charcoal base. One clean self-hosted font pairing. Simple mostly static gear logo. Light fade/slide motion only, disabled for reduced-motion users. No scroll-driven animation libraries. Mobile-first single column, large tap targets.

## Current gap
The code still uses the Garet font from a third-party CDN, `three` (3D gear), `gsap` and `lenis`. See status-and-roadmap.md section 6.

## Consequences
Removing these shrinks bundles for mid-range phones but changes the current look. Do it as a deliberate, reviewed design task, not incidentally.
