import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "../../src/config.js";
import { ArchiveRegistry } from "../../src/registry.js";
import { createServer } from "../../src/server.js";

export interface Harness {
  client: Client;
  close(): Promise<void>;
}

export async function avviaHarness(baseUrl: string, archivi: string): Promise<Harness> {
  const config = loadConfig({ DOMUSTUDIO_ARCHIVES: archivi, DOMUSTUDIO_BASE_URL: baseUrl });
  const registry = new ArchiveRegistry(config, { retryBaseDelayMs: 1 });
  const server = createServer(registry);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

export function testo(risultato: CallToolResult): string {
  return risultato.content
    .filter((parte): parte is { type: "text"; text: string } => parte.type === "text")
    .map((parte) => parte.text)
    .join("\n");
}
