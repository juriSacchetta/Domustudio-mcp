#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { ArchiveRegistry } from "./registry.js";
import { createServer } from "./server.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const registry = new ArchiveRegistry(config);
  const server = createServer(registry);

  await server.connect(new StdioServerTransport());
  console.error(
    `${SERVER_NAME} ${SERVER_VERSION} avviato su stdio — archivi: ${registry.names.join(", ")}`,
  );
}

main().catch((errore: unknown) => {
  console.error(`${SERVER_NAME}: ${errore instanceof Error ? errore.message : String(errore)}`);
  process.exit(1);
});
