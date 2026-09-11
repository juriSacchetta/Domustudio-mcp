import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ArchiveRegistry } from "../registry.js";
import { ANNOTAZIONI_SOLA_LETTURA, NOTA_SOLA_LETTURA, esegui } from "./shared.js";

export function registraStrumentiArchivi(server: McpServer, registry: ArchiveRegistry): void {
  server.registerTool(
    "domustudio_list_archivi",
    {
      title: "Elenca archivi Domustudio configurati",
      description: `Elenca i nomi degli archivi Domustudio configurati su questo server.

Una chiave API indirizza esattamente un archivio; ogni altro strumento accetta un parametro "archivio" che seleziona quale interrogare. Se ne è configurato uno solo, quel parametro può essere omesso.

Nessun parametro.

Restituisce:
{
  "archivi": string[],   // nomi configurati, nell'ordine di configurazione
  "conteggio": number
}

${NOTA_SOLA_LETTURA}`,
      inputSchema: {},
      outputSchema: {
        archivi: z.array(z.string()),
        conteggio: z.number().int(),
      },
      annotations: ANNOTAZIONI_SOLA_LETTURA,
    },
    async () =>
      esegui(async () => {
        const archivi = registry.names;
        const struttura = { archivi, conteggio: archivi.length };
        const testo = archivi.length
          ? `Archivi Domustudio configurati (${archivi.length}):\n` +
            archivi.map((nome) => `- ${nome}`).join("\n")
          : "Nessun archivio Domustudio configurato.";
        return { content: [{ type: "text", text: testo }], structuredContent: struttura };
      }),
  );
}
