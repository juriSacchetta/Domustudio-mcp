import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_PAGES_PER_CALL } from "../constants.js";
import { DomustudioError } from "../errors.js";
import { ArchivioSconosciutoError } from "../registry.js";
import { RESPONSE_FORMATS, troncaTesto } from "../format.js";
import type { ResponseFormat } from "../format.js";

export const campoArchivio = z
  .string()
  .optional()
  .describe(
    "Nome dell'archivio Domustudio da interrogare. Opzionale se ne è configurato uno solo; " +
      "usare domustudio_list_archivi per l'elenco.",
  );

export const campoResponseFormat = z
  .enum(RESPONSE_FORMATS)
  .default("markdown")
  .describe("'markdown' per una sintesi leggibile dei campi principali, 'json' per il record completo.");

export const campoPagina = z
  .number()
  .int()
  .min(1)
  .default(1)
  .describe("Numero di pagina, 1-based (parametro PageNumber dell'API).");

export const campoDimensionePagina = z
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE_SIZE)
  .default(DEFAULT_PAGE_SIZE)
  .describe(`Elementi per pagina (parametro PageSize dell'API). Massimo ${MAX_PAGE_SIZE}.`);

export const campoTutteLePagine = z
  .boolean()
  .default(false)
  .describe(
    `Se true, scorre le pagine successive fino a esaurimento o fino a ${MAX_PAGES_PER_CALL} pagine ` +
      `(il campo troncato_al_limite_pagine segnala il taglio).`,
  );

export const envelopePaginatoShape = {
  archivio: z.string(),
  conteggio: z.number().int(),
  pagina: z.number().int(),
  dimensione_pagina: z.number().int(),
  pagine_lette: z.number().int(),
  ha_altre_pagine: z.boolean(),
  prossima_pagina: z.number().int().optional(),
  troncato_al_limite_pagine: z.boolean(),
  elementi: z.array(z.record(z.string(), z.unknown())),
};

export const envelopeCompletoShape = {
  archivio: z.string(),
  conteggio: z.number().int(),
  elementi: z.array(z.record(z.string(), z.unknown())),
};

export interface RisultatoPaginato {
  archivio: string;
  conteggio: number;
  pagina: number;
  dimensione_pagina: number;
  pagine_lette: number;
  ha_altre_pagine: boolean;
  prossima_pagina?: number;
  troncato_al_limite_pagine: boolean;
  elementi: Record<string, unknown>[];
}

export function componiRisultatoPaginato(args: {
  archivio: string;
  elementi: Record<string, unknown>[];
  pagina: number;
  dimensionePagina: number;
  pagineLette: number;
  troncato: boolean;
  tutteLePagine: boolean;
}): RisultatoPaginato {
  const { archivio, elementi, pagina, dimensionePagina, pagineLette, troncato, tutteLePagine } = args;
  const haAltre = troncato || elementi.length === pagineLette * dimensionePagina;
  return {
    archivio,
    conteggio: elementi.length,
    pagina,
    dimensione_pagina: dimensionePagina,
    pagine_lette: pagineLette,
    ha_altre_pagine: haAltre && elementi.length > 0,
    ...(haAltre && elementi.length > 0 ? { prossima_pagina: pagina + pagineLette } : {}),
    troncato_al_limite_pagine: tutteLePagine && troncato,
    elementi,
  };
}

export function componiRisposta(
  formato: ResponseFormat,
  struttura: Record<string, unknown>,
  markdown: () => string,
): CallToolResult {
  const testo =
    formato === "json" ? JSON.stringify(struttura, null, 2) : markdown();
  return {
    content: [{ type: "text", text: troncaTesto(testo) }],
    structuredContent: struttura,
  };
}

/** Turns configuration and API failures into an `isError` result instead of a protocol error. */
export async function esegui(azione: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await azione();
  } catch (errore) {
    if (errore instanceof DomustudioError || errore instanceof ArchivioSconosciutoError) {
      return { content: [{ type: "text", text: `Errore: ${errore.message}` }], isError: true };
    }
    const messaggio = errore instanceof Error ? errore.message : String(errore);
    return { content: [{ type: "text", text: `Errore inatteso: ${messaggio}` }], isError: true };
  }
}

export const ANNOTAZIONI_SOLA_LETTURA = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const NOTA_SOLA_LETTURA =
  "L'API Domustudio è di sola lettura: espone solo tre endpoint GET. " +
  "Domustudio resta il sistema di registrazione — ogni correzione va fatta da un operatore dentro il gestionale.";
