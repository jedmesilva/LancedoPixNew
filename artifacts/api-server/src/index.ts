import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { startDisputeEngine } from "./lib/lance";
import { attachLanceRealtime } from "./lib/realtime";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
attachLanceRealtime(server);

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  startDisputeEngine((err) => {
    logger.error({ err }, "Dispute engine tick failed");
  });
});
