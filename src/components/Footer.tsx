import { Link } from "@tanstack/react-router";
import { Linkedin } from "lucide-react";
import { InstagramIcon } from "@/components/InstagramIcon";
import { getSettings } from "@/data/site";

export function Footer() {
  const settings = getSettings();
  return (
    <footer className="relative overflow-hidden bg-black text-white/80 border-t border-white/10 transition-colors">
      {/* BACKGROUND ACCENTS — FULL BLACK WITH AMBER ACCENT */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full blur-3xl bg-neutral-900" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full blur-3xl bg-amber-500/15" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          {/* LEFT COLUMN: ONLY LOGOS (CUSAT SOE, INSTAGRAM, LINKEDIN) — NO WRITING */}
          <div className="flex items-center gap-4">
            {/* CUSAT / SOE LOGO */}
            <a
              href="https://soe.cusat.ac.in"
              target="_blank"
              rel="noreferrer"
              aria-label="School of Engineering, CUSAT Website"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-white/40 p-1.5 shadow-lg shadow-black/40 transition-transform duration-200 hover:scale-110 hover:border-amber-400/80"
              title="School of Engineering, Cochin University of Science and Technology (CUSAT)"
            >
              <img
                src="/cusat-crest.webp"
                alt="Cochin University of Science and Technology (CUSAT) emblem"
                className="h-full w-full object-contain drop-shadow-sm"
              />
            </a>

            {/* INSTAGRAM LOGO */}
            {settings.instagramUrl && (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="MESAC CUSAT Instagram Profile"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-lg shadow-rose-950/40 transition-transform duration-200 hover:scale-110"
                title="MESAC Instagram"
              >
                <InstagramIcon className="h-6 w-6 text-white" />
              </a>
            )}

            {/* LINKEDIN LOGO */}
            {settings.linkedinUrl && (
              <a
                href={settings.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="MESAC CUSAT LinkedIn Organization Page"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0077b5] shadow-lg shadow-sky-950/40 transition-transform duration-200 hover:scale-110"
                title="MESAC LinkedIn"
              >
                <Linkedin className="h-6 w-6 text-white" />
              </a>
            )}
          </div>

          {/* RIGHT COLUMN: RESTORED ORIGINAL FOOTER INFO (WITHOUT COCHIN ADDRESS / DIVIDER) */}
          <div className="space-y-2 text-xs text-white/70 leading-relaxed text-center md:text-right">
            <div className="font-semibold text-white">
              Copyright © {new Date().getFullYear()} MESAC CUSAT
            </div>
            <div className="font-medium text-white/90">
              Division of Mechanical Engineering, CUSAT
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 pt-1 text-[11px] text-white/60">
              <Link
                to="/about"
                className="inline-flex min-h-[24px] items-center px-1 hover:text-amber-400 transition"
              >
                About
              </Link>
              <span>·</span>
              <Link
                to="/contact"
                className="inline-flex min-h-[24px] items-center px-1 hover:text-amber-400 transition"
              >
                Contact
              </Link>
              <span>·</span>
              <Link
                to="/archive"
                className="inline-flex min-h-[24px] items-center px-1 hover:text-amber-400 transition"
              >
                Archive
              </Link>
              <span>·</span>
              <Link
                to="/alumni"
                className="inline-flex min-h-[24px] items-center px-1 hover:text-amber-400 transition"
              >
                Alumni
              </Link>
              <span>·</span>
              <Link
                to="/privacy"
                className="inline-flex min-h-[24px] items-center px-1 hover:text-amber-400 transition"
              >
                Privacy Policy
              </Link>
            </div>
            <div>All rights reserved</div>
            {settings.footerText && <div>{settings.footerText}</div>}
          </div>
        </div>
      </div>
    </footer>
  );
}
