import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import type { ArchiveRegistry } from "./registry.js";
import { registraStrumentiArchivi } from "./tools/archivi.js";
import { registraStrumentiCondomini } from "./tools/condomini.js";
import { registraStrumentiFornitori } from "./tools/fornitori.js";
import { registraStrumentiPersone } from "./tools/persone.js";

export function createServer(registry: ArchiveRegistry): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Espone in sola lettura l'API pubblica di Danea Domustudio: condomini, persone e fornitori. " +
        "L'API non offre operazioni di scrittura; Domustudio resta il sistema di registrazione e ogni " +
        "correzione va fatta da un operatore dentro il gestionale. " +
        "Le persone e i fornitori non hanno un identificatore nell'API: si raggiungono filtrando gli elenchi. " +
        "L'id del condominio è l'unico identificatore stabile ed è richiesto per elencare le persone di uno stabile.",
    },
  );

  registraStrumentiArchivi(server, registry);
  registraStrumentiCondomini(server, registry);
  registraStrumentiPersone(server, registry);
  registraStrumentiFornitori(server, registry);

  return server;
}
