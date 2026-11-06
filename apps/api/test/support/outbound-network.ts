import type { OutboundNetwork } from "../../src/common/outbound-http.js";

/** Only external DNS/socket boundaries are replaced; the application policy stays real. */
export const fixtureOutboundNetwork: OutboundNetwork = {
  deadlineMs: 100,
  resolve: async hostname => {
    if (["example.com", "fcm.googleapis.com", "receiver.example.test"].includes(hostname)) {
      return [{ address: "8.8.8.8", family: 4 }];
    }
    throw new Error("No DNS fixture for this hostname");
  },
  request: () => { throw new Error("No outbound receiver configured"); },
};
