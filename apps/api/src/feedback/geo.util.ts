import geoip from "geoip-lite";
import type { AuthorLocation } from "@userhq/types";

let regionNames: Intl.DisplayNames | null = null;
try {
  regionNames = new Intl.DisplayNames(["en"], { type: "region" });
} catch {
  // fallback if Intl.DisplayNames not supported
}

export function resolveLocationFromIp(ip: string | null | undefined): AuthorLocation | null {
  if (!ip) return null;

  const cleanIp = ip.replace(/^::ffff:/, "").trim();
  if (!cleanIp || cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp === "localhost") {
    return null;
  }

  try {
    const geo = geoip.lookup(cleanIp);
    if (!geo || !geo.country) return null;

    let countryName: string = geo.country;
    if (regionNames) {
      try {
        countryName = regionNames.of(geo.country) ?? geo.country;
      } catch {
        countryName = geo.country;
      }
    }

    return {
      country: countryName,
      countryCode: geo.country,
      city: geo.city || null,
    };
  } catch {
    return null;
  }
}
