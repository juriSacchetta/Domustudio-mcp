import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ArchiveRegistry } from "../registry.js";
import { condominioMarkdown } from "../format.js";
import type { ResponseFormat } from "../format.js";
import {
  ANNOTAZIONI_SOLA_LETTURA,
  NOTA_SOLA_LETTURA,
  campoArchivio,
  campoResponseFormat,
  componiRisposta,
  envelopeCompletoShape,
  esegui,
} from "./shared.js";

const CAMPI_RICERCA = ["intestazione", "citta", "prov", "indirizzo", "codFisc"] as const;

function corrisponde(record: Record<string, unknown>, ago: string): boolean {
  const needle = ago.toLocaleLowerCase("it");
  return CAMPI_RICERCA.some((campo) => {
    const valore = record[campo];
    return typeof valore === "string" && valore.toLocaleLowerCase("it").includes(needle);
  });
}

export function registraStrumentiCondomini(server: McpServer, registry: ArchiveRegistry): void {
  server.registerTool(
    "domustudio_list_condomini",
    {
      title: "Elenca condomini",
      description: `Elenca i condomini presenti in un archivio Domustudio.

L'endpoint restituisce sempre la lista completa: non è paginato e non accetta filtri lato API. Il parametro "ricerca" filtra i risultati localmente su intestazione, città, provincia, indirizzo e codice fiscale.

L'"id" di un condominio è l'unico identificatore stabile esposto dall'API Domustudio, ed è il valore da passare come "condominio_id" a domustudio_list_persone.

Args:
  - archivio (string, opzionale): archivio da interrogare
  - ricerca (string, opzionale): sottostringa, confronto case-insensitive
  - response_format ('markdown' | 'json'): default 'markdown'

Restituisce (json):
{
  "archivio": string,
  "conteggio": number,
  "elementi": [ { "id": number, "intestazione": string, "indirizzo": string, "cap": string,
                  "citta": string, "prov": string, "codFisc": string,
                  "amministratore": { "nome": string, "email": string, ... } } ]
}
In formato markdown vengono mostrati intestazione, id, indirizzo, codice fiscale e amministratore; il formato json riporta il record completo restituito dall'API.

Usare quando: serve l'id di un condominio, o l'anagrafica dello stabile.
Non usare per: elencare le persone di un condominio (domustudio_list_persone) o i fornitori (domustudio_list_fornitori).

${NOTA_SOLA_LETTURA}`,
      inputSchema: {
        archivio: campoArchivio,
        ricerca: z
          .string()
          .min(1)
          .optional()
          .describe("Filtro locale su intestazione, città, provincia, indirizzo, codice fiscale."),
        response_format: campoResponseFormat,
      },
      outputSchema: {
        ...envelopeCompletoShape,
        ricerca: z.string().optional(),
      },
      annotations: ANNOTAZIONI_SOLA_LETTURA,
    },
    async ({ archivio, ricerca, response_format }) =>
      esegui(async () => {
        const client = registry.resolve(archivio);
        const tutti = await client.get("condominio");
        const elementi = ricerca ? tutti.filter((r) => corrisponde(r, ricerca)) : tutti;

        const struttura = {
          archivio: client.archivio,
          conteggio: elementi.length,
          ...(ricerca ? { ricerca } : {}),
          elementi,
        };

        return componiRisposta(response_format as ResponseFormat, struttura, () => {
          if (elementi.length === 0) {
            return ricerca
              ? `Nessun condominio corrisponde a "${ricerca}" nell'archivio "${client.archivio}".`
              : `Nessun condominio presente nell'archivio "${client.archivio}".`;
          }
          const intestazione = ricerca
            ? `# Condomini (${elementi.length} su ${tutti.length}) — archivio "${client.archivio}", ricerca "${ricerca}"`
            : `# Condomini (${elementi.length}) — archivio "${client.archivio}"`;
          return [intestazione, "", ...elementi.map(condominioMarkdown)].join("\n\n");
        });
      }),
  );

  server.registerTool(
    "domustudio_get_condominio",
    {
      title: "Leggi un condominio per id",
      description: `Restituisce il singolo condominio con l'id indicato.

L'API non espone una lettura per id: lo strumento scarica la lista completa dei condomini e seleziona la voce corrispondente.

Args:
  - condominio_id (number): id Domustudio del condominio
  - archivio (string, opzionale): archivio da interrogare
  - response_format ('markdown' | 'json'): default 'markdown'

Restituisce (json):
{ "archivio": string, "trovato": boolean, "condominio": object | null }

Errori:
  - "trovato": false se nessun condominio ha quell'id nell'archivio indicato.

${NOTA_SOLA_LETTURA}`,
      inputSchema: {
        condominio_id: z.number().int().describe("Id Domustudio del condominio (campo 'id')."),
        archivio: campoArchivio,
        response_format: campoResponseFormat,
      },
      outputSchema: {
        archivio: z.string(),
        trovato: z.boolean(),
        condominio: z.record(z.string(), z.unknown()).nullable(),
      },
      annotations: ANNOTAZIONI_SOLA_LETTURA,
    },
    async ({ condominio_id, archivio, response_format }) =>
      esegui(async () => {
        const client = registry.resolve(archivio);
        const tutti = await client.get("condominio");
        const trovato = tutti.find((r) => r["id"] === condominio_id) ?? null;

        const struttura = {
          archivio: client.archivio,
          trovato: trovato !== null,
          condominio: trovato,
        };

        return componiRisposta(response_format as ResponseFormat, struttura, () =>
          trovato
            ? condominioMarkdown(trovato)
            : `Nessun condominio con id ${condominio_id} nell'archivio "${client.archivio}".`,
        );
      }),
  );
}
