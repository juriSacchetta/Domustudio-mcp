import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { avviaMockApi, rispondiJson } from "./helpers/mockApi.js";
import type { MockApi } from "./helpers/mockApi.js";
import { cartellaTemporanea } from "./helpers/cartella.js";

const eseguiFile = promisify(execFile);
const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BINARIO = resolve(RADICE, "dist/index.js");

let api: MockApi;
const cartella = cartellaTemporanea("domustudio-stdio-");

beforeEach(async () => {
  api = await avviaMockApi((_req, res) =>
    rispondiJson(res, [{ id: 1, intestazione: "Condominio Via Roma 5", citta: "Treviso" }]),
  );
});

afterEach(async () => {
  await api.close();
});

async function conIlBinario(
  env: Record<string, string>,
  prova: (client: Client) => Promise<void>,
): Promise<void> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [BINARIO],
    env: { PATH: process.env["PATH"] ?? "", ...env },
    cwd: cartella.percorso,
    stderr: "pipe",
  });
  const client = new Client({ name: "stdio-test", version: "0.0.0" });
  try {
    await client.connect(transport);
    await prova(client);
  } finally {
    await client.close();
  }
}

async function elencaCondomini(client: Client): Promise<CallToolResult> {
  return (await client.callTool({
    name: "domustudio_list_condomini",
    arguments: {},
  })) as CallToolResult;
}

describe("binario stdio", () => {
  it("si avvia, annuncia gli strumenti e risponde a una chiamata", async () => {
    await conIlBinario(
      {
        DOMUSTUDIO_ARCHIVES: '[{"name":"desa","api_key":"k1"}]',
        DOMUSTUDIO_BASE_URL: api.baseUrl,
      },
      async (client) => {
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name)).toContain("domustudio_list_condomini");

        const risultato = await elencaCondomini(client);
        expect(risultato.isError).toBeFalsy();
        expect(risultato.structuredContent).toMatchObject({ archivio: "desa", conteggio: 1 });
        expect(api.richieste[0]!.headers["x-danea-api-key"]).toBe("k1");
      },
    );
  });

  it("prende le credenziali da un .env nella directory di lavoro", async () => {
    writeFileSync(
      join(cartella.percorso, ".env"),
      `DOMUSTUDIO_ARCHIVES=[{"name":"desa","api_key":"k1"}]\nDOMUSTUDIO_BASE_URL=${api.baseUrl}\n`,
    );
    await conIlBinario({}, async (client) => {
      const risultato = await elencaCondomini(client);
      expect(risultato.isError).toBeFalsy();
      expect(api.richieste[0]!.headers["x-danea-api-key"]).toBe("k1");
    });
  });

  it("esce con codice 1 e un messaggio su stderr se la configurazione manca", async () => {
    const esito = await eseguiFile(process.execPath, [BINARIO], {
      env: { PATH: process.env["PATH"] ?? "" },
      cwd: cartella.percorso,
    }).catch((errore: unknown) => errore as { code: number; stderr: string });

    expect((esito as { code: number }).code).toBe(1);
    expect((esito as { stderr: string }).stderr).toContain("DOMUSTUDIO_ARCHIVES");
  });
});
