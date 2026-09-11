import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { avviaMockApi, rispondiJson } from "./helpers/mockApi.js";
import type { MockApi } from "./helpers/mockApi.js";

const eseguiFile = promisify(execFile);
const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BINARIO = resolve(RADICE, "dist/index.js");

let api: MockApi;

beforeEach(async () => {
  api = await avviaMockApi((_req, res) =>
    rispondiJson(res, [{ id: 1, intestazione: "Condominio Via Roma 5", citta: "Treviso" }]),
  );
});

afterEach(async () => {
  await api.close();
});

describe("binario stdio", () => {
  it("si avvia, annuncia gli strumenti e risponde a una chiamata", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [BINARIO],
      env: {
        PATH: process.env["PATH"] ?? "",
        DOMUSTUDIO_ARCHIVES: '[{"name":"desa","api_key":"k1"}]',
        DOMUSTUDIO_BASE_URL: api.baseUrl,
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "stdio-test", version: "0.0.0" });

    try {
      await client.connect(transport);

      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toContain("domustudio_list_condomini");

      const risultato = (await client.callTool({
        name: "domustudio_list_condomini",
        arguments: {},
      })) as CallToolResult;

      expect(risultato.isError).toBeFalsy();
      expect(risultato.structuredContent).toMatchObject({ archivio: "desa", conteggio: 1 });
      expect(api.richieste[0]!.headers["x-danea-api-key"]).toBe("k1");
    } finally {
      await client.close();
    }
  });

  it("esce con codice 1 e un messaggio su stderr se la configurazione manca", async () => {
    const esito = await eseguiFile(process.execPath, [BINARIO], {
      env: { PATH: process.env["PATH"] ?? "" },
    }).catch((errore: unknown) => errore as { code: number; stderr: string });

    expect((esito as { code: number }).code).toBe(1);
    expect((esito as { stderr: string }).stderr).toContain("DOMUSTUDIO_ARCHIVES");
  });
});
