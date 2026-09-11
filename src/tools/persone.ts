import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ArchiveRegistry } from "../registry.js";
import { MAX_PAGES_PER_CALL } from "../constants.js";
import { FILTRO_SUBENTRI, decoraPersona } from "../domustudio/enums.js";
import { personaMarkdown } from "../format.js";
import type { ResponseFormat } from "../format.js";
import {
  ANNOTAZIONI_SOLA_LETTURA,
  NOTA_SOLA_LETTURA,
  campoArchivio,
  campoDimensionePagina,
  campoPagina,
  campoResponseFormat,
  campoTutteLePagine,
  componiRisposta,
  componiRisultatoPaginato,
  envelopePaginatoShape,
  esegui,
} from "./shared.js";

export function registraStrumentiPersone(server: McpServer, registry: ArchiveRegistry): void {
  server.registerTool(
    "domustudio_list_persone",
    {
      title: "Elenca persone (anagrafica soggetti)",
      description: `Elenca le persone dell'anagrafica Domustudio, opzionalmente ristrette a un condominio.

L'API non espone un identificatore per le persone: il record non contiene alcun id, quindi non esiste una lettura per id e non c'è modo di indirizzare una persona singola. Per trovare qualcuno si filtra questo elenco (search_query, oppure condominio_id più una lettura dei risultati).

Args:
  - archivio (string, opzionale): archivio da interrogare
  - condominio_id (number, opzionale): restringe a un condominio (parametro CondGendID). Ottenerlo da domustudio_list_condomini
  - filtro_subentri (1|2|3|4|5): 1 tutti, 2 attivi, 3 ex, 4 contabilità, 5 destinatari comunicazioni. Default 2
  - esercizio_id (number, opzionale): parametro EsercizioID
  - tags_id (number[], opzionale): parametro TagsID
  - search_query (string, opzionale): passato all'API come SearchQuery; la semantica è decisa dall'API, non documentata nello spec
  - order_by (string, opzionale): passato all'API come OrderBy, semantica non documentata
  - pagina (number): pagina 1-based, default 1
  - dimensione_pagina (number): elementi per pagina, default 50
  - tutte_le_pagine (boolean): se true scorre le pagine fino a ${MAX_PAGES_PER_CALL}, default false
  - response_format ('markdown' | 'json'): default 'markdown'

Restituisce (json):
{
  "archivio": string,
  "conteggio": number,              // elementi in questa risposta
  "pagina": number,                 // prima pagina letta
  "dimensione_pagina": number,
  "pagine_lette": number,
  "ha_altre_pagine": boolean,       // euristica: l'API non restituisce un totale, quindi è vero quando l'ultima pagina era piena
  "prossima_pagina": number,        // presente solo se ha_altre_pagine
  "troncato_al_limite_pagine": boolean,
  "elementi": [ { "descr": string, "codFisc": string, "piva": string, "indirizzo": string,
                  "cap": string, "citta": string, "prov": string, "email": string[], "pec": string[],
                  "tel1": string, "note": string,
                  "preferenzaPagamentoRate": { "codice": number, "etichetta": string }, ... } ]
}
I campi enumerativi sono restituiti come { codice, etichetta }. Il formato markdown mostra denominazione, codice fiscale, indirizzo, recapiti; json riporta il record completo.

Usare quando: servono i condòmini di uno stabile, i recapiti di un soggetto, o un conteggio per condominio.
Non usare per: i fornitori, che stanno in un'anagrafica separata (domustudio_list_fornitori).

${NOTA_SOLA_LETTURA}`,
      inputSchema: {
        archivio: campoArchivio,
        condominio_id: z
          .number()
          .int()
          .optional()
          .describe("Id del condominio (CondGendID). Omesso, l'API restituisce le persone di tutto l'archivio."),
        filtro_subentri: z
          .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
          .default(2)
          .describe(
            Object.entries(FILTRO_SUBENTRI)
              .map(([codice, etichetta]) => `${codice} ${etichetta.toLocaleLowerCase("it")}`)
              .join(", "),
          ),
        esercizio_id: z.number().int().optional().describe("Id dell'esercizio (EsercizioID)."),
        tags_id: z.array(z.number().int()).optional().describe("Id dei tag (TagsID)."),
        search_query: z.string().optional().describe("Ricerca libera, inoltrata all'API come SearchQuery."),
        order_by: z.string().optional().describe("Ordinamento, inoltrato all'API come OrderBy."),
        pagina: campoPagina,
        dimensione_pagina: campoDimensionePagina,
        tutte_le_pagine: campoTutteLePagine,
        response_format: campoResponseFormat,
      },
      outputSchema: envelopePaginatoShape,
      annotations: ANNOTAZIONI_SOLA_LETTURA,
    },
    async (args) =>
      esegui(async () => {
        const client = registry.resolve(args.archivio);
        const { elementi, pagineLette, troncato } = await client.getPages(
          "persona",
          {
            CondGendID: args.condominio_id,
            FiltroSubentri: args.filtro_subentri,
            EsercizioID: args.esercizio_id,
            TagsID: args.tags_id,
            SearchQuery: args.search_query,
            OrderBy: args.order_by,
          },
          args.pagina,
          args.dimensione_pagina,
          args.tutte_le_pagine ? MAX_PAGES_PER_CALL : 1,
        );

        const struttura = componiRisultatoPaginato({
          archivio: client.archivio,
          elementi: elementi.map(decoraPersona),
          pagina: args.pagina,
          dimensionePagina: args.dimensione_pagina,
          pagineLette,
          troncato,
          tutteLePagine: args.tutte_le_pagine,
        });

        return componiRisposta(
          args.response_format as ResponseFormat,
          struttura as unknown as Record<string, unknown>,
          () => {
            if (struttura.conteggio === 0) {
              return `Nessuna persona trovata nell'archivio "${client.archivio}"${
                args.condominio_id !== undefined ? ` per il condominio ${args.condominio_id}` : ""
              }.`;
            }
            const testata =
              `# Persone (${struttura.conteggio}) — archivio "${client.archivio}"` +
              (args.condominio_id !== undefined ? `, condominio ${args.condominio_id}` : "") +
              `\n\nPagina ${struttura.pagina}, ${struttura.pagine_lette} pagina/e lette.` +
              (struttura.ha_altre_pagine
                ? ` Altre pagine disponibili: richiedere pagina ${struttura.prossima_pagina}.`
                : " Nessuna altra pagina.");
            return [testata, "", ...struttura.elementi.map(personaMarkdown)].join("\n\n");
          },
        );
      }),
  );
}
