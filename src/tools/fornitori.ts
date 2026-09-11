import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ArchiveRegistry } from "../registry.js";
import { MAX_PAGES_PER_CALL } from "../constants.js";
import { decoraFornitore } from "../domustudio/enums.js";
import { fornitoreMarkdown } from "../format.js";
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

export function registraStrumentiFornitori(server: McpServer, registry: ArchiveRegistry): void {
  server.registerTool(
    "domustudio_list_fornitori",
    {
      title: "Elenca fornitori",
      description: `Elenca i fornitori di un archivio Domustudio.

L'anagrafica fornitori è globale sull'archivio, non per condominio: non esiste un parametro che la restringa a uno stabile. Come per le persone, il record non contiene alcun id, quindi non esiste una lettura per id; per trovare un fornitore si filtra questo elenco.

Args:
  - archivio (string, opzionale): archivio da interrogare
  - attivi (boolean, opzionale): solo attivi (true) o solo non attivi (false); omesso, entrambi
  - dati_incompleti (boolean, opzionale): filtra sui fornitori con dati incompleti
  - attivita (string, opzionale): attività del fornitore (parametro Attivita)
  - impianto_servizio_id (number, opzionale): id del servizio collegato (ImpiantoServizioID)
  - esercizi_id (number[], opzionale): esercizi del fornitore (EserciziID)
  - search_query (string, opzionale): passato all'API come SearchQuery, semantica non documentata
  - order_by (string, opzionale): passato all'API come OrderBy, semantica non documentata
  - pagina (number): pagina 1-based, default 1
  - dimensione_pagina (number): elementi per pagina, default 50
  - tutte_le_pagine (boolean): se true scorre le pagine fino a ${MAX_PAGES_PER_CALL}, default false
  - response_format ('markdown' | 'json'): default 'markdown'

Restituisce (json): stesso involucro paginato di domustudio_list_persone, con elementi della forma
{ "descr": string, "fornitoreAttivita": string, "codFisc": string, "piva": string, "iban": string,
  "email": string[], "pec": string[], "tel1": string, "fornitoreInattivo": boolean,
  "descStatoDurc": string, "dataScadenzaDurc": string,
  "f24CodTributo": { "codice": number, "etichetta": string }, ... }
"ha_altre_pagine" è un'euristica: l'API non restituisce un totale, quindi è vero quando l'ultima pagina letta era piena.

Usare quando: serve un fornitore per attività, partita IVA, IBAN o stato DURC.
Non usare per: i condòmini e i soggetti dell'anagrafica persone (domustudio_list_persone).

${NOTA_SOLA_LETTURA}`,
      inputSchema: {
        archivio: campoArchivio,
        attivi: z.boolean().optional().describe("Stato del fornitore (parametro Attivi)."),
        dati_incompleti: z.boolean().optional().describe("Fornitori con dati incompleti (DatiIncompleti)."),
        attivita: z.string().optional().describe("Attività del fornitore (Attivita)."),
        impianto_servizio_id: z
          .number()
          .int()
          .optional()
          .describe("Id del servizio collegato al fornitore (ImpiantoServizioID)."),
        esercizi_id: z.array(z.number().int()).optional().describe("Esercizi del fornitore (EserciziID)."),
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
          "fornitore",
          {
            Attivi: args.attivi,
            DatiIncompleti: args.dati_incompleti,
            Attivita: args.attivita,
            ImpiantoServizioID: args.impianto_servizio_id,
            EserciziID: args.esercizi_id,
            SearchQuery: args.search_query,
            OrderBy: args.order_by,
          },
          args.pagina,
          args.dimensione_pagina,
          args.tutte_le_pagine ? MAX_PAGES_PER_CALL : 1,
        );

        const struttura = componiRisultatoPaginato({
          archivio: client.archivio,
          elementi: elementi.map(decoraFornitore),
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
              return `Nessun fornitore trovato nell'archivio "${client.archivio}".`;
            }
            const testata =
              `# Fornitori (${struttura.conteggio}) — archivio "${client.archivio}"` +
              `\n\nPagina ${struttura.pagina}, ${struttura.pagine_lette} pagina/e lette.` +
              (struttura.ha_altre_pagine
                ? ` Altre pagine disponibili: richiedere pagina ${struttura.prossima_pagina}.`
                : " Nessuna altra pagina.");
            return [testata, "", ...struttura.elementi.map(fornitoreMarkdown)].join("\n\n");
          },
        );
      }),
  );
}
