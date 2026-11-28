/** One content list (team, achievements, placements or alumni): search, show/hide, reorder, edit, delete. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Search } from "lucide-react";
import { PersonAvatar } from "@/components/PersonAvatar";
import type { EntityDef } from "@/shared/entities";
import { api, errorText, type Me } from "./api";
import { EntityForm, type Item } from "./EntityForm";
import { BTN, BTN_PRIMARY, CARD, ConfirmButton, INPUT, Notice } from "./ui";

const PHOTO: Record<string, string> = {
  team: "photo",
  achievements: "image",
  placements: "photo",
  alumni: "photo",
};

export function ContentSection({ def, me }: { def: EntityDef; me: Me }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: Item[] }>("GET", `/content/${def.name}`)).items);
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
    }
  }, [def.name]);

  useEffect(() => {
    setItems(null);
    setEditing(null);
    setMessage(null);
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!items || !q) return items ?? [];
    return items.filter((it) =>
      [def.labelField, ...def.detailFields].some((f) =>
        String(it[f] ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [items, query, def]);

  async function act(id: string, fn: () => Promise<unknown>, done: string) {
    setBusyId(id);
    setMessage(null);
    try {
      await fn();
      await load();
      setMessage({ tone: "ok", text: done });
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
    } finally {
      setBusyId(null);
    }
  }

  const label = (it: Item) => String(it[def.labelField] ?? "");
  const canDelete = def.name !== "alumni" || me.role === "admin";

  if (editing) {
    return (
      <EntityForm
        def={def}
        me={me}
        item={editing === "new" ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSaved={async (saved) => {
          setEditing(null);
          await load();
          setMessage({
            tone: "ok",
            text: `Saved “${label(saved)}”. The public page updates within a minute.`,
          });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            className={`${INPUT} pl-9`}
            placeholder={`Search ${def.title.toLowerCase()}…`}
            aria-label={`Search ${def.title.toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" className="h-4 w-4" /> Add {def.singular}
        </button>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : shown.length === 0 ? (
        <Notice>
          {items.length ? "Nothing matches this search." : `No ${def.title.toLowerCase()} yet.`}
        </Notice>
      ) : (
        <ul className="space-y-3">
          {shown.map((it) => {
            const index = items.findIndex((x) => x.id === it.id);
            const busy = busyId === it.id;
            const details = def.detailFields
              .map((f) => it[f])
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={it.id} className={`${CARD} ${it.visible ? "" : "opacity-75"}`}>
                <div className="flex items-start gap-3">
                  <PersonAvatar
                    name={label(it)}
                    photo={String(it[PHOTO[def.name]] ?? "")}
                    className="h-12 w-12 shrink-0 rounded-xl border border-border/80"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-semibold text-foreground">{label(it)}</div>
                    {details && (
                      <div className="break-words text-xs text-muted-foreground">{details}</div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                      <span className={it.visible ? "text-emerald-300" : "text-muted-foreground"}>
                        {it.visible ? "Shown" : "Hidden"}
                      </span>
                      {def.name === "alumni" && it.consent !== true && (
                        <span className="text-amber-300">· No consent</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-start gap-2">
                  <button
                    type="button"
                    className={BTN}
                    aria-pressed={it.visible === true}
                    disabled={busy || (def.name === "alumni" && it.consent !== true && !it.visible)}
                    title={
                      def.name === "alumni" && it.consent !== true
                        ? "Needs consent first"
                        : undefined
                    }
                    onClick={() =>
                      act(
                        it.id,
                        () => api("PUT", `/content/${def.name}/${it.id}`, { visible: !it.visible }),
                        it.visible ? "Hidden." : "Shown on the site.",
                      )
                    }
                  >
                    {it.visible ? (
                      <EyeOff aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    )}
                    {it.visible ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    className={BTN}
                    aria-label={`Move ${label(it)} up`}
                    disabled={busy || index <= 0}
                    onClick={() =>
                      act(
                        it.id,
                        () =>
                          api("POST", `/content/${def.name}/${it.id}/move`, { direction: "up" }),
                        "Moved up.",
                      )
                    }
                  >
                    <ArrowUp aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={BTN}
                    aria-label={`Move ${label(it)} down`}
                    disabled={busy || index === items.length - 1}
                    onClick={() =>
                      act(
                        it.id,
                        () =>
                          api("POST", `/content/${def.name}/${it.id}/move`, { direction: "down" }),
                        "Moved down.",
                      )
                    }
                  >
                    <ArrowDown aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <OrderInput
                    value={it.order}
                    label={label(it)}
                    disabled={busy}
                    onSave={(order) =>
                      act(
                        it.id,
                        () => api("PUT", `/content/${def.name}/${it.id}`, { order }),
                        "Order saved.",
                      )
                    }
                  />
                  <button type="button" className={BTN} onClick={() => setEditing(it)}>
                    <Pencil aria-hidden="true" className="h-4 w-4" /> Edit
                  </button>
                  {canDelete && (
                    <ConfirmButton
                      label="Delete"
                      confirmLabel={def.name === "alumni" ? "Delete permanently" : "Yes, delete"}
                      busy={busy}
                      onConfirm={() =>
                        act(it.id, () => api("DELETE", `/content/${def.name}/${it.id}`), "Deleted.")
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OrderInput({
  value,
  label,
  disabled,
  onSave,
}: {
  value: unknown;
  label: string;
  disabled: boolean;
  onSave: (order: number | null) => void;
}) {
  const initial = value == null ? "" : String(value);
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial]);
  const commit = () => {
    if (text === initial) return;
    const t = text.trim();
    if (t !== "" && !/^-?\d+$/.test(t)) return setText(initial);
    onSave(t === "" ? null : Number(t));
  };
  return (
    <input
      type="number"
      step={1}
      inputMode="numeric"
      aria-label={`Order of ${label}`}
      className={INPUT.replace("w-full", "w-20")}
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}
