/** Create / edit form for one team member, achievement, placement or alumnus. */
import { useId, useState, type FormEvent } from "react";
import type { EntityDef, FieldDef } from "@/shared/entities";
import { ApiError, api, errorText, type Me } from "./api";
import { PhotoField } from "./PhotoField";
import { BTN, BTN_PRIMARY, CARD, Field, INPUT, Notice } from "./ui";

export type Item = Record<string, string | number | boolean | null> & { id: string };

function initialValues(def: EntityDef, item?: Item) {
  const v: Record<string, string> = {};
  for (const f of def.fields) v[f.name] = item ? String(item[f.name] ?? "") : "";
  return v;
}

export function EntityForm({
  def,
  item,
  me,
  onSaved,
  onCancel,
}: {
  def: EntityDef;
  item?: Item;
  me: Me;
  onSaved: (item: Item) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const isAlumni = def.name === "alumni";
  const [values, setValues] = useState(() => initialValues(def, item));
  const [visible, setVisible] = useState<boolean>(item ? item.visible === true : !isAlumni);
  const [consent, setConsent] = useState<boolean>(item?.consent === true);
  const [order, setOrder] = useState(item?.order == null ? "" : String(item.order));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));
  const fieldId = (f: string) => `${uid}-${f}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage("");
    const body: Record<string, unknown> = {
      ...values,
      visible: isAlumni ? visible && consent : visible,
    };
    body.order = order.trim() === "" ? null : Number(order);
    if (isAlumni) body.consent = consent;
    try {
      const res = item
        ? await api<{ item: Item }>("PUT", `/content/${def.name}/${item.id}`, body)
        : await api<{ item: Item }>("POST", `/content/${def.name}`, body);
      onSaved(res.item);
    } catch (err) {
      setMessage(errorText(err));
      if (err instanceof ApiError) setErrors(err.errors);
    } finally {
      setBusy(false);
    }
  }

  function input(f: FieldDef) {
    const id = fieldId(f.name);
    const describedBy = errors[f.name] ? `${id}-error` : f.help ? `${id}-help` : undefined;
    const common = {
      id,
      value: values[f.name],
      "aria-invalid": Boolean(errors[f.name]) || undefined,
      "aria-describedby": describedBy,
      className: INPUT,
      placeholder: f.placeholder,
      maxLength: f.max,
      required: f.required,
    };
    switch (f.kind) {
      case "longtext":
        return <textarea {...common} rows={5} onChange={(e) => set(f.name, e.target.value)} />;
      case "photo":
        return (
          <PhotoField
            id={id}
            name={values.name || values.title || ""}
            value={values[f.name]}
            onChange={(v) => set(f.name, v)}
            uploads={me.uploads}
            describedBy={describedBy}
          />
        );
      default: {
        const type = { url: "url", linkedin: "url", email: "email", phone: "tel", date: "date" }[
          f.kind as string
        ];
        return (
          <input
            {...common}
            type={type ?? "text"}
            inputMode={f.kind === "phone" ? "tel" : undefined}
            onChange={(e) => set(f.name, e.target.value)}
          />
        );
      }
    }
  }

  return (
    <form onSubmit={submit} className={`${CARD} space-y-4`} noValidate>
      <h2 className="font-display text-lg font-bold text-foreground">
        {item ? `Edit ${def.singular}` : `Add ${def.singular}`}
      </h2>
      {isAlumni && (
        <Notice tone="warn">
          Everything here is public: anyone can see the email, phone and LinkedIn you enter. Add
          contact details only with the person&apos;s written consent, and keep that consent record
          outside this site.
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {def.fields.map((f) => (
          <div
            key={f.name}
            className={f.kind === "longtext" || f.kind === "photo" ? "sm:col-span-2" : ""}
          >
            <Field
              id={fieldId(f.name)}
              label={f.label}
              help={f.help}
              error={errors[f.name]}
              required={f.required}
            >
              {input(f)}
            </Field>
          </div>
        ))}
        <Field
          id={fieldId("order")}
          label="Order"
          help="Lower numbers come first. Empty: at the end."
          error={errors.order}
        >
          <input
            id={fieldId("order")}
            className={INPUT}
            type="number"
            step={1}
            inputMode="numeric"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </Field>
      </div>

      {isAlumni && (
        <label className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/5 p-3 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--gold)]"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              if (!e.target.checked) setVisible(false);
            }}
          />
          <span>
            <strong>Consent:</strong> this person has given written consent to publish these details
            on the MESAC website. <span className="text-gold">(required to show them)</span>
          </span>
        </label>
      )}
      <label className="flex items-center gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--gold)]"
          checked={isAlumni ? visible && consent : visible}
          disabled={isAlumni && !consent}
          onChange={(e) => setVisible(e.target.checked)}
        />
        Show on the website
        {isAlumni && !consent && (
          <span className="text-[11px] text-muted-foreground">(needs consent first)</span>
        )}
      </label>
      {errors.visible && <Notice tone="error">{errors.visible}</Notice>}
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
