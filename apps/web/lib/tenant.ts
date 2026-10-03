export function portalHref(ws: string, product?: string): string {
  if (product) {
    return `/${ws}/${product}`;
  }
  return `/${ws}`;
}

export function postHref(
  ws: string,
  product: string,
  number: number,
  slug?: string | null
): string {
  const cleanSlug = slug?.trim();
  if (!cleanSlug) {
    return `/${ws}/${product}/p/${number}`;
  }
  return `/${ws}/${product}/p/${number}-${cleanSlug}`;
}

export function parsePostRef(ref: string): number | null {
  const match = ref.match(/^(\d+)(?:-|$)/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return Number.isInteger(num) && num > 0 ? num : null;
}
