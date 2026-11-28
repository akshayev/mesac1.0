/** The site settings (the same keys as the Sheet's settings tab), plus the papers-refresh placeholder. */
import { useEffect, useId, useState, type FormEvent } from "react";
import { SETTING_KEYS } from "../../../scripts/lib/validate.mjs";
import { SETTING_LABELS } from "@/shared/entities";
import { ApiError, api, errorText } from "./api";
import { BTN, BTN_PRIMARY, CARD, Field, INPUT, Notice } from "./ui";

const HINT = { text: undefined, email: "email", url: "url", link: "text" } as const;

export function SettingsSection() {
  const uid = useId();
  const [saved, setSaved] = useState<Record<string, string> | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ values: Record<string, string> }>("GET", "/settings")
      .then((r) => {
        setSaved(r.values);
        setValues(r.values);
      })
      .catch((err) => setMessage({ tone: "error", text: errorText(err) }));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!saved) return;
    const changed = Object.fromEntries(
      Object.keys(SETTING_KEYS)
        .filter((k) => (values[k] ?? "") !== (saved[k] ?? ""))
        .map((k) => [k, values[k] ?? ""]),
    );
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const r = await api<{ values: Record<string, string>; changed: string[] }>(
        "PUT",
        "/settings",
        changed,
      );
      setSaved(r.values);
      setValues(r.values);
      setMessage({ tone: "ok", text: r.changed.length ? "Settings saved." : "Nothing changed." });
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
      if (err instanceof ApiError) setErrors(err.errors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className={`${CARD} space-y-2`} aria-labelledby={`${uid}-papers`}>
        <h2 id={`${uid}-papers`} className="font-display text-base font-bold text-foreground">
          Question papers
        </h2>
        <p className="text-sm text-muted-foreground">
          Papers come from Google Drive and are refreshed every night. To refresh now, open GitHub →
          Actions → Build and deploy → Run workflow.
        </p>
        <button type="button" className={BTN} disabled aria-describedby={`${uid}-papers-note`}>
          Refresh papers now
        </button>
        <p id={`${uid}-papers-note`} className="text-[11px] text-muted-foreground">
          Not available yet: this button will be added in a later update.
        </p>
      </section>

      <form onSubmit={submit} className={`${CARD} space-y-4`} noValidate>
        <h2 className="font-display text-base font-bold text-foreground">Site settings</h2>
        <p className="text-sm text-muted-foreground">An empty box hides that item on the site.</p>
        {saved === null && !message && <p className="text-sm text-muted-foreground">Loading…</p>}
        {saved && (
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(SETTING_KEYS).map(([key, kind]) => {
              const meta = SETTING_LABELS[key] ?? { label: key };
              const id = `${uid}-${key}`;
              const common = {
                id,
                className: INPUT,
                value: values[key] ?? "",
                maxLength: 500,
                "aria-invalid": Boolean(errors[key]) || undefined,
                "aria-describedby": errors[key]
                  ? `${id}-error`
                  : meta.help
                    ? `${id}-help`
                    : undefined,
              };
              return (
                <div key={key} className={meta.long ? "sm:col-span-2" : ""}>
                  <Field id={id} label={meta.label} help={meta.help} error={errors[key]}>
                    {meta.long ? (
                      <textarea
                        {...common}
                        rows={3}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        {...common}
                        type={HINT[kind] ?? "text"}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      />
                    )}
                  </Field>
                </div>
              );
            })}
          </div>
        )}
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <button type="submit" className={BTN_PRIMARY} disabled={busy || !saved}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
