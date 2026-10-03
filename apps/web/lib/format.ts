const mediumDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

export function formatDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return mediumDateFormatter.format(d);
}
