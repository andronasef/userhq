import {
  ATTRIBUTE_MAX_PARAMS,
  ATTRIBUTE_PARAM_VALUE_MAX,
  ATTRIBUTE_PARAM_KEY_MAX,
} from "@userhq/types";

export function readAttributionParams(search: string): {
  params: Record<string, string>;
  signatureKeys: string[];
} {
  const params: Record<string, string> = Object.create(null);
  for (const [key, value] of new URLSearchParams(search)) {
    if (Object.keys(params).length >= ATTRIBUTE_MAX_PARAMS) break;
    if (
      key.length <= ATTRIBUTE_PARAM_KEY_MAX &&
      value.length <= ATTRIBUTE_PARAM_VALUE_MAX
    )
      params[key] = value;
  }
  const signatureKeys = Object.keys(params).filter(
    (key) =>
      /_(sig|ts)$/.test(key) &&
      Object.hasOwn(params, key.replace(/_(sig|ts)$/, "")),
  );
  return { params, signatureKeys };
}

export function stripParams(
  location: { pathname: string; search: string; hash: string },
  keys: string[],
): string {
  const search = new URLSearchParams(location.search);
  for (const key of keys) search.delete(key);
  const query = search.toString();
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
}
