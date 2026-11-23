import { useEffect, useRef, useState } from "react";
import type { AchievementEntry } from "@/types";
import { Trophy, ExternalLink, ImageOff } from "lucide-react";
import { formatAchievementDate } from "@/lib/format";

export interface AchievementCardProps {
  achievement: AchievementEntry;
  className?: string;
}

export function AchievementCard({ achievement, className = "" }: AchievementCardProps) {
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // An image that already failed during server rendering never fires onError after hydration.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setImgError(true);
  }, [achievement.image]);
  const dateLabel = formatAchievementDate(achievement.date);

  return (
    <article
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-neutral-950/75 border border-white/10 p-5 sm:p-6 transition-all duration-300 hover:border-amber-400/40 hover:shadow-2xl hover:shadow-black/50 card-lift h-full motion-reduce:transition-none motion-reduce:hover:transform-none ${className}`}
    >
      <div>
        {achievement.image && (
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/15 bg-black/60 shadow-lg mb-5">
            {!imgError ? (
              <img
                ref={imgRef}
                src={achievement.image}
                alt={achievement.title}
                referrerPolicy="no-referrer"
                loading="lazy"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-neutral-900 text-muted-foreground">
                <ImageOff className="h-8 w-8 text-gold/60 mb-1.5" />
                <span className="text-xs font-mono">Image unavailable</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-950 shadow">
            <Trophy className="h-3 w-3" aria-hidden="true" />
            <span>{achievement.category || "Achievement"}</span>
          </span>
          {dateLabel && <span className="text-xs font-mono text-gold/80">{dateLabel}</span>}
        </div>

        <h3 className="font-display text-lg sm:text-xl font-bold leading-snug text-white tracking-wide group-hover:text-amber-300 transition-colors">
          {achievement.title}
        </h3>

        {achievement.description && (
          <p className="mt-3 whitespace-pre-line text-xs sm:text-sm font-normal text-slate-200 leading-relaxed">
            {achievement.description}
          </p>
        )}
      </div>

      {achievement.link && (
        <div className="mt-5 pt-4 border-t border-white/10">
          <a
            href={achievement.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-white transition min-h-[44px]"
          >
            <span>Read more</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </article>
  );
}
