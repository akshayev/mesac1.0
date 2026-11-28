/** Small building blocks shared by the dashboard sections (reusing the site's colours and focus ring). */
import type { ReactNode } from "react";

export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export const INPUT = `w-full min-h-[44px] rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-gold ${FOCUS}`;
export const BTN = `inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-secondary/60 px-3 text-xs font-semibold text-foreground transition hover:border-gold/60 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
export const BTN_PRIMARY = `inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl gradient-gold px-4 text-sm font-bold text-primary shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;
export const BTN_DANGER = `inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-red-500/50 bg-red-500/10 px-3 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 ${FOCUS}`;
export const CARD = "rounded-2xl border border-border/80 bg-card p-4 shadow-sm";

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "error" | "ok";
  children: ReactNode;
}) {
  const styles = {
    info: "border-border/80 bg-secondary/40 text-muted-foreground",
    warn: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    error: "border-red-500/50 bg-red-500/10 text-red-200",
    ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border px-3 py-2 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}

export function Field({
  id,
  label,
  help,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-foreground">
        {label}
        {required && <span className="text-gold"> *</span>}
      </label>
      {children}
      {help && !error && (
        <p id={`${id}-help`} className="text-[11px] text-muted-foreground">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[11px] font-semibold text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

/** Two-step delete: the first tap asks, the second confirms (no browser dialogs). */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  busy,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <details className="group relative">
      <summary className={`${BTN} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}>
        {label}
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-red-500/40 bg-background p-2">
        <span className="text-xs text-muted-foreground">Are you sure?</span>
        <button type="button" className={BTN_DANGER} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </details>
  );
}
