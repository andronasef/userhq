import type { DeviceInfo } from "@userhq/types";

export function parseUserAgent(userAgent?: string | null): DeviceInfo | null {
  if (!userAgent || typeof userAgent !== "string") {
    return null;
  }

  const ua = userAgent.trim();
  if (!ua) {
    return null;
  }

  let browser: string | null = null;
  let os: string | null = null;
  let device: string | null = null;

  // 1. Detect OS
  if (/Windows NT 10\.0/i.test(ua)) {
    os = "Windows 10/11";
  } else if (/Windows NT 6\.3/i.test(ua)) {
    os = "Windows 8.1";
  } else if (/Windows NT 6\.1/i.test(ua)) {
    os = "Windows 7";
  } else if (/Windows/i.test(ua)) {
    os = "Windows";
  } else if (/iPhone/i.test(ua)) {
    os = "iOS";
  } else if (/iPad/i.test(ua)) {
    os = "iPadOS";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macOS";
  } else if (/Android/i.test(ua)) {
    os = "Android";
  } else if (/CrOS/i.test(ua)) {
    os = "ChromeOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  // 2. Detect Device Form Factor
  if (/iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || /Tablet/i.test(ua)) {
    device = "Tablet";
  } else if (/iPhone|iPod|Mobile|Windows Phone|BlackBerry/i.test(ua)) {
    device = "Mobile";
  } else if (os) {
    device = "Desktop";
  }

  // 3. Detect Browser (Order matters: check specialized browsers first)
  const arcMatch = ua.match(/Arc\/(\d+)/i);
  const edgMatch = ua.match(/(?:Edg|Edge)\/(\d+)/i);
  const oprMatch = ua.match(/(?:OPR|Opera)\/(\d+)/i);
  const samsungMatch = ua.match(/SamsungBrowser\/(\d+)/i);
  const firefoxMatch = ua.match(/(?:Firefox|FxiOS)\/(\d+)/i);
  const chromeMatch = ua.match(/(?:Chrome|CriOS)\/(\d+)/i);
  const safariMatch = ua.match(/Version\/(\d+)(?:\.\d+)*.*Safari/i);

  if (arcMatch) {
    browser = `Arc ${arcMatch[1]}`;
  } else if (edgMatch) {
    browser = `Edge ${edgMatch[1]}`;
  } else if (oprMatch) {
    browser = `Opera ${oprMatch[1]}`;
  } else if (samsungMatch) {
    browser = `Samsung Internet ${samsungMatch[1]}`;
  } else if (firefoxMatch) {
    browser = `Firefox ${firefoxMatch[1]}`;
  } else if (chromeMatch) {
    browser = `Chrome ${chromeMatch[1]}`;
  } else if (safariMatch) {
    browser = `Safari ${safariMatch[1]}`;
  }

  if (!browser && !os && !device) {
    return null;
  }

  return {
    browser,
    os,
    device,
  };
}
