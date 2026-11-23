/** "2026-03-14" -> "14 Mar 2026" (UTC so the day never shifts with the viewer's timezone). */
export function formatAchievementDate(date: string | null): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
