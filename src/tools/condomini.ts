import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ArchiveRegistry } from "../registry.js";
import { MAX_PAGE_SIZE } from "../constants.js";
import { condominioMarkdown } from "../format.js";
import type { ResponseFormat } from "../format.js";
import {
  ANNOTAZIONI_SOLA_LETTURA,
  NOTA_SOLA_LETTURA,
  campoArchivio,
  campoResponseFormat,
  campoPagina,
  campoDimensionePagina,
  componiRisposta,
  envelopeCompletoShape,
  esegui,
} from "./shared.js";

const CAMPI_RICERCA = ["intestazione", "citta", "prov", "indirizzo", "codFisc"] as const;
const CAMPI_LISTA = ["id", "intestazione", "indirizzo", "cap", "citta", "prov", "codFisc"] as const;

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

L'API restituisce la lista completa; questo strumento applica ricerca e paginazione localmente. Se conosci nome o indirizzo dello stabile, usa "ricerca": confronto case-insensitive su intestazione, città, provincia, indirizzo e codice fiscale, prima della paginazione.

L'"id" di un condominio è l'unico identificatore stabile esposto dall'API Domustudio, ed è il valore da passare come "condominio_id" a domustudio_list_persone.

Args:
  - archivio (string, opzionale): archivio da interrogare
  - ricerca (string, opzionale): sottostringa, confronto case-insensitive
  - pagina (integer): prima pagina 1, default 1
  - dimensione_pagina (integer): default 25, massimo ${MAX_PAGE_SIZE}
  - response_format ('markdown' | 'json'): default 'markdown'

Restituisce (json):
{
  "archivio": string,
  "conteggio": number,
  "totale": number,
  "pagina": number,
  "dimensione_pagina": number,
  "ha_altre_pagine": boolean,
  "prossima_pagina"?: number,
  "elementi": [ { "id": number, "intestazione": string, "indirizzo": string, "cap": string,
                  "citta": string, "prov": string, "codFisc": string } ]
}
Entrambi i formati restituiscono solo campi identificativi compatti. "conteggio" conta gli elementi della pagina; "totale" tutte le corrispondenze. Per enumerare tutto, segui "prossima_pagina" mantenendo archivio, ricerca e dimensione_pagina. Per il record completo usa domustudio_get_condominio.

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
        pagina: campoPagina.describe("Pagina locale dei condomini, a partire da 1."),
        dimensione_pagina: campoDimensionePagina.default(25).describe(`Elementi per pagina locale: default 25, massimo ${MAX_PAGE_SIZE}.`),
        response_format: campoResponseFormat.describe("'markdown' o 'json': entrambi restituiscono una pagina compatta; per i dettagli usare domustudio_get_condominio."),
      },
      outputSchema: {
        ...envelopeCompletoShape,
        totale: z.number().int(),
        pagina: z.number().int(),
        dimensione_pagina: z.number().int(),
        ha_altre_pagine: z.boolean(),
        prossima_pagina: z.number().int().optional(),
        ricerca: z.string().optional(),
      },
      annotations: ANNOTAZIONI_SOLA_LETTURA,
    },
    async ({ archivio, ricerca, pagina, dimensione_pagina, response_format }) =>
      esegui(async () => {
        const client = registry.resolve(archivio);
        const tutti = await client.get("condominio");
        const corrispondenze = ricerca ? tutti.filter((r) => corrisponde(r, ricerca)) : tutti;
        const inizio = (pagina - 1) * dimensione_pagina;
        const elementi = corrispondenze.slice(inizio, inizio + dimensione_pagina).map((record) =>
          Object.fromEntries(CAMPI_LISTA.filter((campo) => campo in record).map((campo) => [campo, record[campo]])),
        );
        const haAltre = inizio + elementi.length < corrispondenze.length;

        const struttura = {
          archivio: client.archivio,
          conteggio: elementi.length,
          totale: corrispondenze.length,
          pagina,
          dimensione_pagina,
          ha_altre_pagine: haAltre,
          ...(haAltre ? { prossima_pagina: pagina + 1 } : {}),
          ...(ricerca ? { ricerca } : {}),
          elementi,
        };

        return componiRisposta(response_format as ResponseFormat, struttura, () => {
          const stato = `Pagina ${pagina} — ${elementi.length} di ${corrispondenze.length} corrispondenze. ` +
            (haAltre ? `Altre pagine: sì. Prossima pagina: ${pagina + 1}.` : "Altre pagine: no.");
          if (elementi.length === 0) {
            if (corrispondenze.length > 0) return `${stato}\n\nNessun condominio in questa pagina.`;
            const assenza = ricerca
              ? `Nessun condominio corrisponde a "${ricerca}" nell'archivio "${client.archivio}".`
              : `Nessun condominio presente nell'archivio "${client.archivio}".`;
            return `${stato}\n\n${assenza}`;
          }
          const intestazione = ricerca
            ? `# Condomini (${elementi.length} su ${corrispondenze.length}) — archivio "${client.archivio}", ricerca "${ricerca}"`
            : `# Condomini (${elementi.length}) — archivio "${client.archivio}"`;
          return [intestazione, stato, ...elementi.map(condominioMarkdown)].join("\n\n");
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
