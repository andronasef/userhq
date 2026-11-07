import http from "node:http";
import type { AddressInfo, Socket } from "node:net";
import type { OutboundNetwork } from "../../src/common/outbound-http.js";
import { fixtureOutboundNetwork } from "./outbound-network.js";

export interface ReceivedRequest {
  path: string;
  headers: http.IncomingHttpHeaders;
  body: string;
  /** X-UserHQ-Delivery, the webhook_deliveries row id. */
  deliveryId: string;
}

export interface ReceiverReply {
  status?: number;
  /** Wait this long before answering. */
  delayMs?: number;
  /** Wait for this promise before answering (hold the request open). */
  gate?: Promise<unknown>;
  /** Accept the request and never answer. */
  hang?: boolean;
  /** Answer 200 and stream this many bytes of body. */
  bigBodyBytes?: number;
}

export type ReceiverHandler = (req: ReceivedRequest) => ReceiverReply | Promise<ReceiverReply>;

/** A local http receiver on 127.0.0.1 that records every request and lets the caller script each answer. */
export async function startReceiver(onRequest: ReceiverHandler = () => ({ status: 200 })) {
  const requests: ReceivedRequest[] = [];
  const sockets = new Set<Socket>();
  let inFlight = 0;
  const state = { inFlightPeak: 0 };

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      const received: ReceivedRequest = {
        path: req.url ?? "/",
        headers: req.headers,
        body,
        deliveryId: String(req.headers["x-userhq-delivery"] ?? ""),
      };
      requests.push(received);
      inFlight++;
      state.inFlightPeak = Math.max(state.inFlightPeak, inFlight);
      try {
        const reply = await onRequest(received);
        if (reply.hang) return;
        if (reply.gate) await reply.gate;
        if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
        if (reply.bigBodyBytes) {
          res.writeHead(200, { "Content-Type": "text/plain" });
          const chunk = "x".repeat(64 * 1024);
          for (let sent = 0; sent < reply.bigBodyBytes && !res.destroyed; sent += chunk.length) res.write(chunk);
          res.end();
          return;
        }
        res.writeHead(reply.status ?? 200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } finally {
        inFlight--;
      }
    });
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    port,
    url: `https://receiver.example.test:${port}/hook`,
    requests,
    get inFlightPeak() {
      return state.inFlightPeak;
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

/** Real outbound policy, with https://receiver.example.test:{port} routed to http://127.0.0.1:{port}. */
export function receiverNetwork({ deadlineMs }: { deadlineMs: number }): OutboundNetwork {
  return {
    ...fixtureOutboundNetwork,
    deadlineMs,
    request: (url, options, response) => {
      if (url.hostname !== "receiver.example.test") throw new Error("No fixture receiver");
      return http.request(new URL(`http://127.0.0.1:${url.port}${url.pathname}`), options, response);
    },
  };
}
