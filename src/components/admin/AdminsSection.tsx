/** Who may use the dashboard (admin role only). Cloudflare Access must also allow the same email. */
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { ApiError, api, errorText, type Me } from "./api";
import { BTN, BTN_PRIMARY, CARD, ConfirmButton, Field, INPUT, Notice } from "./ui";

interface Account {
  id: string;
  email: string;
  role: "admin" | "editor";
  active: boolean;
}

export function AdminsSection({ me }: { me: Me }) {
  const uid = useId();
  const [admins, setAdmins] = useState<Account[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setAdmins((await api<{ admins: Account[] }>("GET", "/admins")).admins);
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function run(fn: () => Promise<unknown>, done: string) {
    setMessage(null);
    setErrors({});
    try {
      await fn();
      await load();
      setMessage({ tone: "ok", text: done });
      return true;
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
      if (err instanceof ApiError) setErrors(err.errors);
      return false;
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (
      await run(
        () => api("POST", "/admins", { email, role }),
        "Added. Also allow this email in Cloudflare Access.",
      )
    ) {
      setEmail("");
      setRole("editor");
    }
  }

  return (
    <div className="space-y-4">
      <Notice>
        Two places decide who gets in: the Cloudflare Access policy (who may sign in) and this list
        (what they may do). An email must be in both. Editors edit content; admins can also manage
        this list and delete alumni permanently.
      </Notice>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <form
        onSubmit={add}
        className={`${CARD} grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end`}
        noValidate
      >
        <Field id={`${uid}-email`} label="Email" error={errors.email}>
          <input
            id={`${uid}-email`}
            type="email"
            className={INPUT}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            required
          />
        </Field>
        <Field id={`${uid}-role`} label="Role" error={errors.role}>
          <select
            id={`${uid}-role`}
            className={INPUT}
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "editor")}
          >
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <button type="submit" className={BTN_PRIMARY}>
          Add
        </button>
      </form>
      {admins === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {admins.map((a) => (
            <li key={a.id} className={`${CARD} space-y-2`}>
              <div className="break-all font-semibold text-foreground">
                {a.email}
                {a.email === me.email && <span className="ml-2 text-[11px] text-gold">(you)</span>}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <select
                  aria-label={`Role of ${a.email}`}
                  className={INPUT.replace("w-full", "w-auto")}
                  value={a.role}
                  onChange={(e) =>
                    run(
                      () => api("PUT", `/admins/${a.id}`, { role: e.target.value }),
                      "Role changed.",
                    )
                  }
                >
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="button"
                  className={BTN}
                  aria-pressed={a.active}
                  onClick={() =>
                    run(
                      () => api("PUT", `/admins/${a.id}`, { active: !a.active }),
                      a.active ? "Deactivated." : "Activated.",
                    )
                  }
                >
                  {a.active ? "Deactivate" : "Activate"}
                </button>
                <ConfirmButton
                  label="Remove"
                  confirmLabel="Yes, remove"
                  onConfirm={() => run(() => api("DELETE", `/admins/${a.id}`), "Removed.")}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
