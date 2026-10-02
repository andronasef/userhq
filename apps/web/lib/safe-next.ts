export function safeNext(
  raw: string | string[] | null | undefined,
  fallback = "/"
): string {
  if (!raw || typeof raw !== "string" || !raw.startsWith("/")) {
    return fallback;
  }
  if (raw.startsWith("//") || raw.startsWith("/\\") || raw.includes("\\")) {
    return fallback;
  }
  // Check for control characters or newlines
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 32 || code === 127) {
      return fallback;
    }
  }

  try {
    const u = new URL(raw, "http://internal.invalid");
    if (u.origin !== "http://internal.invalid") {
      return fallback;
    }
    if (
      u.pathname.startsWith("/api/") ||
      u.pathname === "/login" ||
      u.pathname.startsWith("/login/")
    ) {
      return fallback;
    }
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
