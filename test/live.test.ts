import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { leggiFileEnv } from "../src/env.js";
import { ArchiveRegistry } from "../src/registry.js";
import { avviaHarness, testo } from "./helpers/harness.js";
import { DEFAULT_BASE_URL } from "../src/constants.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const env = { ...leggiFileEnv(resolve(RADICE, ".env")), ...process.env };
const attivo = env["DOMUSTUDIO_LIVE"] === "1" && Boolean(env["DOMUSTUDIO_ARCHIVES"]);

describe.skipIf(!attivo)("API Domustudio reale", () => {
  const config = attivo
    ? loadConfig(env as NodeJS.ProcessEnv)
    : { baseUrl: DEFAULT_BASE_URL, archives: [] };

  it("usa HTTPS verso l'host di produzione", () => {
    expect(config.baseUrl.startsWith("https://")).toBe(true);
  });

  it("legge i condomini e ne restituisce l'id", async () => {
    const registry = new ArchiveRegistry(config);
    const condomini = await registry.resolve(config.archives[0]!.name).get("condominio");

    expect(Array.isArray(condomini)).toBe(true);
    expect(condomini.length).toBeGreaterThan(0);
    expect(typeof condomini[0]!["id"]).toBe("number");
  });

  it("rifiuta una chiave errata con un errore di autenticazione, non di parsing", async () => {
    const registry = new ArchiveRegistry({ baseUrl: config.baseUrl, archives: [{ name: "falso", apiKey: "chiave-non-valida" }] });
    await expect(registry.resolve("falso").get("condominio")).rejects.toThrow(/X-DANEA-API-KEY/);
  });

  it("elenca le persone del primo condominio attraverso gli strumenti MCP", async () => {
    const harness = await avviaHarness(config.baseUrl, JSON.stringify(
      config.archives.map((a) => ({ name: a.name, api_key: a.apiKey })),
    ));
    try {
      const condomini = (await harness.client.callTool({
        name: "domustudio_list_condomini",
        arguments: { archivio: config.archives[0]!.name, response_format: "json" },
      })) as CallToolResult;
      const elencati = (condomini.structuredContent as { elementi: Record<string, unknown>[] }).elementi;
      expect(elencati.length).toBeGreaterThan(0);

      const persone = (await harness.client.callTool({
        name: "domustudio_list_persone",
        arguments: {
          archivio: config.archives[0]!.name,
          condominio_id: elencati[0]!["id"],
          dimensione_pagina: 5,
        },
      })) as CallToolResult;

      expect(persone.isError).toBeFalsy();
      expect(testo(persone)).not.toContain("Errore:");
    } finally {
      await harness.close();
    }
  });

  it("legge i fornitori dell'archivio", async () => {
    const harness = await avviaHarness(config.baseUrl, JSON.stringify(
      config.archives.map((a) => ({ name: a.name, api_key: a.apiKey })),
    ));
    try {
      const fornitori = (await harness.client.callTool({
        name: "domustudio_list_fornitori",
        arguments: { archivio: config.archives[0]!.name, dimensione_pagina: 5 },
      })) as CallToolResult;
      expect(fornitori.isError).toBeFalsy();
    } finally {
      await harness.close();
    }
  });
});
