const mediumDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

export function formatDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return mediumDateFormatter.format(d);
}

// Changelog entries dated in the future stay off the public portal until then.
export function isScheduled(publishedAt: string | null | undefined): boolean {
  return Boolean(publishedAt) && new Date(publishedAt!).getTime() > Date.now();
}
