import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { logger } from "./logger";

const WEBSOCKET_PATH = "/api/lance/ws";
const MAX_CLIENTS = 1_000;

let realtimeServer: WebSocketServer | null = null;
let revision = 0;

export function attachLanceRealtime(server: HttpServer): void {
  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 1_024,
    perMessageDeflate: false,
  });
  const alive = new WeakSet<WebSocket>();

  const heartbeat = setInterval(() => {
    for (const client of websocketServer.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (!alive.has(client)) {
        client.terminate();
        continue;
      }
      alive.delete(client);
      client.ping();
    }
  }, 30_000);
  heartbeat.unref();

  server.on("upgrade", (request, socket, head) => {
    let pathname: string;
    try {
      pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }

    if (pathname !== WEBSOCKET_PATH) {
      socket.destroy();
      return;
    }

    if (websocketServer.clients.size >= MAX_CLIENTS) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (client) => {
      websocketServer.emit("connection", client, request);
    });
  });

  websocketServer.on("connection", (client) => {
    alive.add(client);
    client.on("pong", () => alive.add(client));
    client.on("error", (error) => {
      logger.debug({ err: error }, "Lance do Pix WebSocket client error");
    });
    client.send(JSON.stringify({ type: "connected", revision }));
  });

  server.once("close", () => {
    clearInterval(heartbeat);
    for (const client of websocketServer.clients) client.close();
    websocketServer.close();
  });

  realtimeServer = websocketServer;
}

export function notifyLanceStateChanged(): void {
  const websocketServer = realtimeServer;
  if (!websocketServer) return;

  revision += 1;
  const message = JSON.stringify({ type: "state_changed", revision });
  for (const client of websocketServer.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(message, (error) => {
      if (!error) return;
      logger.warn({ err: error }, "Could not publish Lance do Pix update");
      client.terminate();
    });
  }
}
