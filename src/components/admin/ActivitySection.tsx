/**
 * The activity log: who changed what and when. Only field names are recorded. Team, achievements,
 * placements and settings show a name/title; alumni and admin changes never do.
 */
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "./api";
import { BTN, CARD, Notice } from "./ui";

interface Entry {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  label: string | null;
  fields: string[];
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function ActivitySection() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [more, setMore] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (before?: string) => {
    try {
      const q = before ? `?before=${encodeURIComponent(before)}` : "";
      const r = await api<{ entries: Entry[] }>("GET", `/audit${q}`);
      setEntries((prev) => (before && prev ? [...prev, ...r.entries] : r.entries));
      setMore(r.entries.length === 50);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);
  useEffect(() => void load(), [load]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (entries === null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (entries.length === 0) return <Notice>No changes yet.</Notice>;
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.id} className={`${CARD} text-sm`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-semibold text-foreground">
                {e.action} · {e.entity}
                {e.label ? `: ${e.label}` : ""}
              </span>
              <time dateTime={e.at} className="text-[11px] text-muted-foreground">
                {when(e.at)}
              </time>
            </div>
            <div className="break-all text-xs text-muted-foreground">
              by {e.actor}
              {e.fields.length > 0 && ` · fields: ${e.fields.join(", ")}`}
            </div>
          </li>
        ))}
      </ul>
      {more && (
        <button type="button" className={BTN} onClick={() => load(entries[entries.length - 1]?.at)}>
          Load older
        </button>
      )}
    </div>
  );
}
