/** Settings-screen cards: "Refresh papers now" (editors and admins) and unused-photo cleanup (admins). */
import { useId, useState } from "react";
import { api, errorText, type Me } from "./api";
import { BTN, BTN_PRIMARY, CARD, ConfirmButton, Notice } from "./ui";

export function RefreshCard({ me }: { me: Me }) {
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const { enabled, actionsUrl } = me.refresh;

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ message: string }>("POST", "/refresh-papers", {});
      setMessage({ tone: "ok", text: r.message });
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${CARD} space-y-2`} aria-labelledby={`${uid}-papers`}>
      <h2 id={`${uid}-papers`} className="font-display text-base font-bold text-foreground">
        Question papers
      </h2>
      <p className="text-sm text-muted-foreground">
        Papers come from Google Drive and are refreshed every night. After adding or renaming files
        you can refresh now; the site updates a few minutes later.
      </p>
      {enabled ? (
        <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={refresh}>
          {busy ? "Starting…" : "Refresh papers now"}
        </button>
      ) : actionsUrl ? (
        <p className="text-sm text-muted-foreground">
          Open{" "}
          <a
            href={actionsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[24px] items-center font-semibold text-gold underline"
          >
            Run workflow
          </a>{" "}
          on GitHub (then “Run workflow” → main).
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          On GitHub: Actions → Build and deploy → Run workflow.
        </p>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </section>
  );
}

interface Scan {
  unused: number;
  tooNew: number;
  scanned: number;
  bytes: number;
  truncated: boolean;
}

export function CleanupCard({ me }: { me: Me }) {
  const uid = useId();
  const [scan, setScan] = useState<Scan | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function check() {
    setBusy(true);
    setMessage(null);
    try {
      setScan(await api<Scan>("GET", "/media/unused"));
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  async function clean() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ deleted: number; remaining: number }>("POST", "/media/cleanup", {});
      setScan(null);
      setMessage({
        tone: "ok",
        text: `${r.deleted} unused photo${r.deleted === 1 ? "" : "s"} deleted.${r.remaining ? ` ${r.remaining} more: run it again.` : ""}`,
      });
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${CARD} space-y-2`} aria-labelledby={`${uid}-photos`}>
      <h2 id={`${uid}-photos`} className="font-display text-base font-bold text-foreground">
        Unused photos
      </h2>
      {!me.uploads ? (
        <p className="text-sm text-muted-foreground">
          Photo storage (R2) is not set up on this site, so there is nothing to clean.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Photos that were uploaded but are not used by any entry (for example a form that was
            cancelled). Photos from the last 24 hours are always kept.
          </p>
          <button type="button" className={BTN} disabled={busy} onClick={check}>
            Check for unused photos
          </button>
          {scan && (
            <div className="space-y-2" role="status">
              <p className="text-sm text-foreground">
                {scan.unused === 0
                  ? "No unused photos to delete."
                  : `${scan.unused} unused photo${scan.unused === 1 ? "" : "s"} (${Math.round(scan.bytes / 1024)} KB).`}{" "}
                <span className="text-muted-foreground">
                  {scan.tooNew > 0 && `${scan.tooNew} newer than 24 hours kept. `}
                  {scan.truncated &&
                    "There are more files than one check covers; run it again afterwards."}
                </span>
              </p>
              {scan.unused > 0 && (
                <ConfirmButton
                  label={`Delete ${scan.unused} photo${scan.unused === 1 ? "" : "s"}`}
                  confirmLabel="Yes, delete them"
                  busy={busy}
                  onConfirm={clean}
                />
              )}
            </div>
          )}
        </>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </section>
  );
}
