const sections = ["", "/roadmap", "/changelog", "/faq", "/activity"];

/** Only bridge changes between top-level sections of the same public product. */
export function isPortalSectionChange(
  previous: string | null,
  next: string,
  basePath: string,
): boolean {
  if (!/^\/[^/?#]+\/[^/?#]+$/.test(basePath)) return false;
  if (/^\/(?:admin|api|dashboard|dev|login)(?:\/|$)/.test(basePath))
    return false;
  if (!previous || previous === next) return false;
  const paths = sections.map((section) => `${basePath}${section}`);
  return paths.includes(previous) && paths.includes(next);
}
