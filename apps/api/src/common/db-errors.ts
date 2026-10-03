export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  if (!e || typeof e !== "object") return false;
  const cause = (e as any).cause ?? e;
  const code = cause?.code ?? (e as any).code;

  if (code !== "23505") return false;

  if (constraint !== undefined) {
    const c = cause?.constraint ?? (e as any).constraint;
    return c === constraint;
  }

  return true;
}
