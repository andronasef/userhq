import { cookies, headers } from "next/headers";
import type { SupportedLocale } from "@userhq/types";
import { LOCALE_COOKIE_NAME, resolveLocale, getDictionary } from "./index";

export { getDictionary };

/** The visitor's language for this request: saved cookie, then Accept-Language. */
export async function getRequestLocale(): Promise<SupportedLocale> {
  return resolveLocale({
    cookieLang: (await cookies()).get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: (await headers()).get("accept-language"),
  });
}
