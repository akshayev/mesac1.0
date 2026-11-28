/**
 * Alumni who added themselves with the public form. Nothing here is public until approved. Approving copies
 * the entry to Alumni (consent from the form); approving or rejecting empties the submission's personal
 * fields. Rejected entries, and entries waiting more than 30 days, are deleted when this screen loads.
 */
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { ENTITIES } from "@/shared/entities";
import { ApiError, api, errorText, type Me } from "./api";
import { PhotoField } from "./PhotoField";
import { BTN, BTN_PRIMARY, CARD, ConfirmButton, Field, INPUT, Notice } from "./ui";

interface Submission {
  id: string;
  createdAt: string;
  consentTextVersion: string;
  consentAt: string;
  [field: string]: string;
}

const FIELDS = ENTITIES.alumni.fields;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function SubmissionsSection({ me }: { me: Me }) {
  const [items, setItems] = useState<Submission[] | null>(null);
  const [editing, setEditing] = useState<Submission | null>(null);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: Submission[] }>("GET", "/submissions")).items);
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function act(id: string, fn: () => Promise<unknown>, done: string) {
    setBusy(id);
    setMessage(null);
    try {
      await fn();
      await load();
      setMessage({ tone: "ok", text: done });
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(null);
    }
  }

  if (editing) {
    return (
      <EditSubmission
        item={editing}
        me={me}
        onCancel={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
          setMessage({ tone: "ok", text: "Changes saved. Approve when ready." });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Notice>
        Entries from the public form. They are not on the site until you approve them. Check that
        the details look genuine; if in doubt, contact the person before approving.
      </Notice>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Notice>No submissions waiting.</Notice>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => {
            const visible = show[s.id] ?? true;
            return (
              <li key={s.id} className={`${CARD} space-y-3`}>
                <div>
                  <div className="break-words font-semibold text-foreground">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Sent {when(s.createdAt)} · consent wording {s.consentTextVersion}
                  </div>
                </div>
                <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  {FIELDS.filter((f) => f.name !== "name" && s[f.name]).map((f) => (
                    <div key={f.name} className="min-w-0">
                      <dt className="inline text-muted-foreground">{f.label}: </dt>
                      <dd className="inline break-words text-foreground">{s[f.name]}</dd>
                    </div>
                  ))}
                </dl>
                <label className="flex items-center gap-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--gold)]"
                    checked={visible}
                    onChange={(e) => setShow((m) => ({ ...m, [s.id]: e.target.checked }))}
                  />
                  Show on the site after approval
                </label>
                <div className="flex flex-wrap items-start gap-2">
                  <button
                    type="button"
                    className={BTN_PRIMARY}
                    disabled={busy === s.id}
                    onClick={() =>
                      act(
                        s.id,
                        () => api("POST", `/submissions/${s.id}/approve`, { visible }),
                        visible
                          ? "Approved and shown on Alumni Connect."
                          : "Approved (hidden for now: see Alumni).",
                      )
                    }
                  >
                    Approve
                  </button>
                  <button type="button" className={BTN} onClick={() => setEditing(s)}>
                    Edit first
                  </button>
                  <ConfirmButton
                    label="Reject"
                    confirmLabel="Yes, reject and erase"
                    busy={busy === s.id}
                    onConfirm={() =>
                      act(
                        s.id,
                        () => api("POST", `/submissions/${s.id}/reject`, {}),
                        "Rejected; the details were erased.",
                      )
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EditSubmission({
  item,
  me,
  onCancel,
  onSaved,
}: {
  item: Submission;
  me: Me;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const uid = useId();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.name, item[f.name] ?? ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage("");
    try {
      await api("PUT", `/submissions/${item.id}`, values);
      onSaved();
    } catch (err) {
      setMessage(errorText(err));
      if (err instanceof ApiError) setErrors(err.errors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${CARD} space-y-4`} noValidate>
      <h2 className="font-display text-lg font-bold text-foreground">Edit before approving</h2>
      <p className="text-sm text-muted-foreground">
        Fix typos or add a photo. Consent was given on the form ({item.consentTextVersion},{" "}
        {when(item.consentAt)}).
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const id = `${uid}-${f.name}`;
          return (
            <div key={f.name} className={f.kind === "photo" ? "sm:col-span-2" : ""}>
              <Field
                id={id}
                label={f.label}
                help={f.help}
                error={errors[f.name]}
                required={f.required || f.name === "batch"}
              >
                {f.kind === "photo" ? (
                  <PhotoField
                    id={id}
                    name={values.name}
                    value={values.photo}
                    uploads={me.uploads}
                    onChange={(v) => setValues((s) => ({ ...s, photo: v }))}
                  />
                ) : (
                  <input
                    id={id}
                    className={INPUT}
                    value={values[f.name]}
                    maxLength={f.max ?? 200}
                    aria-invalid={Boolean(errors[f.name]) || undefined}
                    onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                  />
                )}
              </Field>
            </div>
          );
        })}
      </div>
      {message && <Notice tone="error">{message}</Notice>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_PRIMARY} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className={BTN} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
