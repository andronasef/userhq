import webpush from "web-push";
import type { Env } from "../env.js";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let cachedKeys: VapidKeys | null = null;

export function getVapidKeys(env: Env): VapidKeys {
  // Checked before the cache so a warm cache can never mask missing production keys.
  if (env.NODE_ENV === "production" && !(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)) {
    throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required in production");
  }
  if (cachedKeys) {
    return cachedKeys;
  }

  const subject = env.VAPID_SUBJECT || "mailto:notifications@userhq.com";

  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    cachedKeys = {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject,
    };
  } else {
    // Generate ephemeral VAPID keys for dev/test when not explicitly provided
    const generated = webpush.generateVAPIDKeys();
    cachedKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject,
    };
  }

  webpush.setVapidDetails(
    cachedKeys.subject,
    cachedKeys.publicKey,
    cachedKeys.privateKey
  );

  return cachedKeys;
}
