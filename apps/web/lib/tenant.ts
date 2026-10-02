export function portalHref(ws: string, product?: string): string {
  if (product) {
    return `/${ws}/${product}`;
  }
  return `/${ws}`;
}
