const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function formatDate(
  isoOrDate: string | Date,
  locale?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const loc = locale || "en";
  const opts = options ?? { dateStyle: "medium" };
  const key = `${loc}:${JSON.stringify(opts)}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat(loc, opts);
    } catch {
      fmt = new Intl.DateTimeFormat("en", opts);
    }
    formatterCache.set(key, fmt);
  }
  return fmt.format(d);
}

export function formatRelativeTime(
  isoOrDate: string | Date,
  locale?: string | null,
): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const loc = locale || "en";

  try {
    const rtf = new Intl.RelativeTimeFormat(loc, { numeric: "auto" });
    if (diffSec < 60) return rtf.format(0, "second");
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return rtf.format(-diffMin, "minute");
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return rtf.format(-diffHr, "hour");
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return rtf.format(-diffDays, "day");
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return rtf.format(-diffMonths, "month");
    const diffYears = Math.floor(diffDays / 365);
    return rtf.format(-diffYears, "year");
  } catch {
    return formatDate(d, loc);
  }
}

// Changelog entries dated in the future stay off the public portal until then.
export function isScheduled(publishedAt: string | null | undefined): boolean {
  return Boolean(publishedAt) && new Date(publishedAt!).getTime() > Date.now();
}
