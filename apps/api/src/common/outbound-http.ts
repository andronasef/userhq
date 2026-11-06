import { Inject, Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { BlockList, isIP } from "node:net";
import { request, type RequestOptions } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { ApiException } from "./api-error.filter.js";

export const OUTBOUND_NETWORK = Symbol("OUTBOUND_NETWORK");
export interface OutboundNetwork {
  resolve(hostname: string): Promise<LookupAddress[]>;
  request(url: URL, options: RequestOptions, response: (res: IncomingMessage) => void): ClientRequest;
  deadlineMs: number;
}
export const systemOutboundNetwork: OutboundNetwork = {
  resolve: hostname => lookup(hostname, { all: true, verbatim: true }),
  request: (url, options, response) => request(url, options, response),
  deadlineMs: 10_000,
};

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedV4.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new BlockList();
for (const [address, prefix] of [
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
] as const) blockedV6.addSubnet(address, prefix, "ipv6");

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, "ipv4");
  return family === 6 && globalV6.check(address, "ipv6") && !blockedV6.check(address, "ipv6");
}

function invalidTarget(): ApiException {
  return new ApiException("invalid_url", 400, "Use an HTTPS URL that resolves only to public internet addresses, without URL credentials.");
}

@Injectable()
export class OutboundHttp {
  constructor(@Inject(OUTBOUND_NETWORK) private readonly network: OutboundNetwork) {}

  async validateTarget(raw: string): Promise<{ url: URL; address: LookupAddress }> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        this.resolveTarget(raw),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(invalidTarget()), this.network.deadlineMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async resolveTarget(raw: string): Promise<{ url: URL; address: LookupAddress }> {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw invalidTarget();
      const hostname = url.hostname.replace(/^\[|\]$/g, "");
      const family = isIP(hostname);
      const addresses = family
        ? [{ address: hostname, family }]
        : await this.network.resolve(hostname);
      if (!addresses.length || addresses.some(a => !isPublicAddress(a.address) || isIP(a.address) !== a.family)) throw invalidTarget();
      return { url, address: addresses[0] };
    } catch {
      throw invalidTarget();
    }
  }
}
