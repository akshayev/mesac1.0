import { useEffect, useRef, useState } from "react";
import { getInitials } from "@/lib/people";

/**
 * Round-cornered photo that falls back to an initials tile when there is no photo,
 * or when the image fails to load (a bad Sheet link must never leave a broken-image icon).
 */
export function PersonAvatar({
  name,
  photo,
  className = "",
}: {
  name: string;
  photo?: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // An image that already failed during server rendering never fires onError after hydration.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setFailedSrc(photo ?? null);
  }, [photo]);
  const showPhoto = Boolean(photo) && failedSrc !== photo;

  if (showPhoto) {
    return (
      <img
        ref={imgRef}
        src={photo}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(photo ?? null)}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={`flex items-center justify-center bg-gradient-to-br from-secondary to-card font-display font-bold text-gold ${className}`}
    >
      <span className="text-[clamp(1rem,22%,2.75rem)] leading-none">
        {getInitials(name) || "?"}
      </span>
    </div>
  );
}
