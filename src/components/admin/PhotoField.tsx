/**
 * Photo picker: shrinks the chosen image in the browser (max 600 px, WebP, at most 300 KB) and uploads it.
 * A link (https, Google Drive, people/name.webp) can also be typed instead.
 */
import { useRef, useState } from "react";
import { PersonAvatar } from "@/components/PersonAvatar";
import { api, errorText } from "./api";
import { BTN, INPUT } from "./ui";

const MAX_SIDE = 600;
const MAX_BYTES = 300 * 1024;

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot resize images.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  for (const quality of [0.85, 0.75, 0.65, 0.5, 0.4]) {
    let blob = await toBlob("image/webp", quality);
    // Older browsers ignore WebP and return PNG: use JPEG there.
    if (blob && blob.type !== "image/webp") blob = await toBlob("image/jpeg", quality);
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("This photo is still larger than 300 KB after shrinking. Try another one.");
}

export function PhotoField({
  id,
  name,
  value,
  onChange,
  uploads,
  describedBy,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  uploads: boolean;
  describedBy?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const blob = await shrink(file);
      const { path } = await api<{ path: string }>("POST", "/upload", blob);
      onChange(path);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <PersonAvatar
          name={name || "?"}
          photo={value}
          className="h-16 w-16 shrink-0 rounded-2xl border border-border/80"
        />
        <div className="flex flex-wrap gap-2">
          {uploads ? (
            <>
              <input
                ref={fileRef}
                id={`${id}-file`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="peer sr-only"
                onChange={(e) => pick(e.target.files?.[0])}
              />
              <label
                htmlFor={`${id}-file`}
                className={`${BTN} cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-gold`}
              >
                {busy ? "Uploading…" : "Choose photo"}
              </label>
            </>
          ) : (
            <p id={`${id}-no-upload`} role="note" className="text-[11px] text-muted-foreground">
              Photo upload needs R2 photo storage, which is not set up on this site. Paste an
              https:// image link or a Google Drive share link below instead.
            </p>
          )}
          {value && (
            <button type="button" className={BTN} onClick={() => onChange("")}>
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        id={id}
        className={INPUT}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="or paste a link: https://…, a Google Drive link, people/name.webp"
        aria-describedby={
          [describedBy, uploads ? "" : `${id}-no-upload`].filter(Boolean).join(" ") || undefined
        }
      />
      {error && <p className="text-[11px] font-semibold text-red-300">{error}</p>}
    </div>
  );
}
