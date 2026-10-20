import { describe, it, expect } from "vitest";
import { parseUserAgent } from "../src/feedback/device-info.js";

describe("parseUserAgent", () => {
  it("returns null for empty, null, or undefined user-agents", () => {
    expect(parseUserAgent(null)).toBeNull();
    expect(parseUserAgent(undefined)).toBeNull();
    expect(parseUserAgent("")).toBeNull();
    expect(parseUserAgent("   ")).toBeNull();
  });

  it("parses macOS Chrome desktop", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
    const res = parseUserAgent(ua);
    expect(res).toEqual({
      browser: "Chrome 128",
      os: "macOS",
      device: "Desktop",
    });
  });

  it("parses macOS Safari desktop", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
    const res = parseUserAgent(ua);
    expect(res).toEqual({
      browser: "Safari 17",
      os: "macOS",
      device: "Desktop",
    });
  });

  it("parses Windows 10/11 Edge desktop", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.2739.67";
    const res = parseUserAgent(ua);
    expect(res).toEqual({
      browser: "Edge 128",
      os: "Windows 10/11",
      device: "Desktop",
    });
  });

  it("parses iPhone Safari mobile", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1";
    const res = parseUserAgent(ua);
    expect(res).toEqual({
      browser: "Safari 17",
      os: "iOS",
      device: "Mobile",
    });
  });

  it("parses Android Chrome mobile", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.88 Mobile Safari/537.36";
    const res = parseUserAgent(ua);
    expect(res).toEqual({
      browser: "Chrome 128",
      os: "Android",
      device: "Mobile",
    });
  });

  it("parses iPad tablet", () => {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
    const res = parseUserAgent(ua);
    expect(res).toEqual({
      browser: "Safari 16",
      os: "iPadOS",
      device: "Tablet",
    });
  });

  it("parses Linux Firefox desktop", () => {
    const ua =
      "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";
    const res = parseUserAgent(ua);
    expect(res).toEqual({
      browser: "Firefox 130",
      os: "Linux",
      device: "Desktop",
    });
  });

  it("parses Arc browser", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Arc/128";
    const res = parseUserAgent(ua);
    expect(res).toEqual({
      browser: "Arc 128",
      os: "macOS",
      device: "Desktop",
    });
  });
});
