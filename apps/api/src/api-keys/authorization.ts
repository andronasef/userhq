/** Classify key credentials before considering any accompanying session cookie. */
export function apiKeyToken(authorization: unknown): string | null {
  if (typeof authorization !== "string") return null;
  const match = /^Bearer[ \t]+(uhq_live_.*)$/i.exec(authorization);
  return match ? match[1].trim() : null;
}
