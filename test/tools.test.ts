import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MAX_PAGES_PER_CALL } from "../src/constants.js";
import { avviaHarness, testo } from "./helpers/harness.js";
import type { Harness } from "./helpers/harness.js";
import {
  avviaMockApi,
  gestorePaginato,
  rispondi401Troncato,
  rispondiJson,
} from "./helpers/mockApi.js";
import type { MockApi } from "./helpers/mockApi.js";

const UN_ARCHIVIO = '[{"name":"desa","api_key":"k1"}]';
const DUE_ARCHIVI = '[{"name":"desa","api_key":"k1"},{"name":"altro","api_key":"k2"}]';

const CONDOMINI = [
  {
    id: 1,
    intestazione: "Condominio Via Roma 5",
    indirizzo: "Via Roma 5",
    cap: "31100",
    citta: "Treviso",
    prov: "TV",
    codFisc: "94000000001",
    amministratore: { nome: "Studio DeSa", email: "info@example.test" },
  },
  {
    id: 2,
    intestazione: "Residenza Aurora",
    indirizzo: "Viale Europa 10",
    cap: "30100",
    citta: "Venezia",
    prov: "VE",
    codFisc: "94000000002",
    amministratore: { nome: "Studio DeSa" },
  },
];

let api: MockApi;
let harness: Harness;

async function apri(archivi = UN_ARCHIVIO): Promise<void> {
  harness = await avviaHarness(api.baseUrl, archivi);
}

function chiama(nome: string, argomenti: Record<string, unknown> = {}): Promise<CallToolResult> {
  return harness.client.callTool({ name: nome, arguments: argomenti }) as Promise<CallToolResult>;
}

beforeEach(async () => {
  api = await avviaMockApi();
});

afterEach(async () => {
  await harness?.close();
  await api.close();
});

describe("listTools", () => {
  beforeEach(() => apri());

  it("espone i cinque strumenti attesi, tutti in sola lettura", async () => {
    const { tools } = await harness.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "domustudio_get_condominio",
      "domustudio_list_archivi",
      "domustudio_list_condomini",
      "domustudio_list_fornitori",
      "domustudio_list_persone",
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.annotations?.destructiveHint, tool.name).toBe(false);
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.inputSchema.type, tool.name).toBe("object");
    }
  });

  it("non espone alcuno strumento di scrittura", async () => {
    const { tools } = await harness.client.listTools();
    for (const tool of tools) {
      expect(tool.name).not.toMatch(/create|update|delete|write|set_|post/i);
    }
  });

  it("genera uno schema JSON coerente per i parametri di paginazione", async () => {
    const { tools } = await harness.client.listTools();
    const persone = tools.find((t) => t.name === "domustudio_list_persone")!;
    const props = persone.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props["condominio_id"]!["type"]).toBe("integer");
    expect(props["dimensione_pagina"]!["maximum"]).toBe(500);
    expect(props["pagina"]!["minimum"]).toBe(1);
    expect(props["response_format"]!["enum"]).toEqual(["markdown", "json"]);
    expect(persone.outputSchema?.type).toBe("object");
  });
});

describe("domustudio_list_archivi", () => {
  it("elenca gli archivi configurati", async () => {
    await apri(DUE_ARCHIVI);
    const risultato = await chiama("domustudio_list_archivi");
    expect(risultato.structuredContent).toEqual({ archivi: ["desa", "altro"], conteggio: 2 });
    expect(testo(risultato)).toContain("- desa");
    expect(testo(risultato)).toContain("- altro");
  });
});

describe("domustudio_list_condomini", () => {
  beforeEach(() => {
    api.setGestore((_req, res) => rispondiJson(res, CONDOMINI));
  });

  it("restituisce tutti i condomini in markdown", async () => {
    await apri();
    const risultato = await chiama("domustudio_list_condomini");

    expect(api.richieste[0]!.path).toBe("/api/external/condominio");
    expect(risultato.structuredContent).toMatchObject({ archivio: "desa", conteggio: 2 });
    expect(testo(risultato)).toContain("# Condomini (2) — archivio \"desa\"");
    expect(testo(risultato)).toContain("## Condominio Via Roma 5 — id 1");
    expect(testo(risultato)).toContain("## Residenza Aurora — id 2");
  });

  it("restituisce il record completo in json", async () => {
    await apri();
    const risultato = await chiama("domustudio_list_condomini", { response_format: "json" });
    const analizzato = JSON.parse(testo(risultato)) as Record<string, unknown>;
    expect(analizzato["elementi"]).toEqual(CONDOMINI);
  });

  it("filtra localmente sulla ricerca, senza parametri aggiuntivi verso l'API", async () => {
    await apri();
    const risultato = await chiama("domustudio_list_condomini", { ricerca: "venezia" });

    expect([...api.richieste[0]!.query.keys()]).toEqual([]);
    expect(risultato.structuredContent).toMatchObject({ conteggio: 1, ricerca: "venezia" });
    expect(testo(risultato)).toContain("Residenza Aurora");
    expect(testo(risultato)).not.toContain("Via Roma 5");
  });

  it("dichiara esplicitamente l'assenza di risultati", async () => {
    await apri();
    const risultato = await chiama("domustudio_list_condomini", { ricerca: "inesistente" });
    expect(risultato.structuredContent).toMatchObject({ conteggio: 0 });
    expect(testo(risultato)).toContain('Nessun condominio corrisponde a "inesistente"');
  });

  it("usa l'archivio richiesto quando ne è configurato più di uno", async () => {
    await apri(DUE_ARCHIVI);
    const risultato = await chiama("domustudio_list_condomini", { archivio: "altro" });
    expect(risultato.structuredContent).toMatchObject({ archivio: "altro" });
    expect(api.richieste[0]!.headers["x-danea-api-key"]).toBe("k2");
  });

  it("chiede quale archivio quando ce n'è più di uno e non è indicato", async () => {
    await apri(DUE_ARCHIVI);
    const risultato = await chiama("domustudio_list_condomini");
    expect(risultato.isError).toBe(true);
    expect(testo(risultato)).toContain("desa, altro");
    expect(api.richieste).toHaveLength(0);
  });

  it("segnala un archivio inesistente senza chiamare l'API", async () => {
    await apri();
    const risultato = await chiama("domustudio_list_condomini", { archivio: "fantasma" });
    expect(risultato.isError).toBe(true);
    expect(testo(risultato)).toContain('Archivio "fantasma" non configurato');
  });
});

describe("domustudio_get_condominio", () => {
  beforeEach(() => {
    api.setGestore((_req, res) => rispondiJson(res, CONDOMINI));
  });

  it("seleziona il condominio con l'id richiesto", async () => {
    await apri();
    const risultato = await chiama("domustudio_get_condominio", { condominio_id: 2 });
    expect(risultato.structuredContent).toMatchObject({ trovato: true });
    expect(testo(risultato)).toContain("## Residenza Aurora — id 2");
  });

  it("riporta trovato=false per un id assente, senza errore di protocollo", async () => {
    await apri();
    const risultato = await chiama("domustudio_get_condominio", { condominio_id: 99 });
    expect(risultato.isError).toBeFalsy();
    expect(risultato.structuredContent).toMatchObject({ trovato: false, condominio: null });
    expect(testo(risultato)).toContain("Nessun condominio con id 99");
  });
});

describe("domustudio_list_persone", () => {
  it("applica i valori di default: filtro subentri 2, pagina 1, pagina da 50", async () => {
    api.setGestore(gestorePaginato(3, (i) => ({ descr: `Persona ${i}` })));
    await apri();
    await chiama("domustudio_list_persone", { condominio_id: 7 });

    const query = api.richieste[0]!.query;
    expect(api.richieste[0]!.path).toBe("/api/external/persona");
    expect(query.get("CondGendID")).toBe("7");
    expect(query.get("FiltroSubentri")).toBe("2");
    expect(query.get("PageNumber")).toBe("1");
    expect(query.get("PageSize")).toBe("50");
  });

  it("inoltra tutti i filtri, ripetendo la chiave per i tag", async () => {
    api.setGestore(gestorePaginato(1, () => ({ descr: "X" })));
    await apri();
    await chiama("domustudio_list_persone", {
      condominio_id: 7,
      filtro_subentri: 3,
      esercizio_id: 2024,
      tags_id: [4, 9],
      search_query: "rossi",
      order_by: "descr",
    });

    const query = api.richieste[0]!.query;
    expect(query.get("FiltroSubentri")).toBe("3");
    expect(query.get("EsercizioID")).toBe("2024");
    expect(query.getAll("TagsID")).toEqual(["4", "9"]);
    expect(query.get("SearchQuery")).toBe("rossi");
    expect(query.get("OrderBy")).toBe("descr");
  });

  it("decodifica gli enum e li mostra per etichetta in markdown", async () => {
    api.setGestore((_req, res) =>
      rispondiJson(res, [
        { descr: "Rossi Mario", preferenzaPagamentoRate: 4, preferenzaTipoInvioRacc: 2 },
      ]),
    );
    await apri();
    const risultato = await chiama("domustudio_list_persone", { condominio_id: 1 });

    const struttura = risultato.structuredContent as { elementi: Record<string, unknown>[] };
    expect(struttura.elementi[0]!["preferenzaPagamentoRate"]).toEqual({
      codice: 4,
      etichetta: "MAV",
    });
    expect(testo(risultato)).toContain("- **Preferenza pagamento rate:** MAV");
  });

  it("segnala altre pagine quando la pagina letta è piena", async () => {
    api.setGestore(gestorePaginato(100, (i) => ({ descr: `Persona ${i}` })));
    await apri();
    const risultato = await chiama("domustudio_list_persone", { dimensione_pagina: 10 });

    expect(risultato.structuredContent).toMatchObject({
      conteggio: 10,
      pagina: 1,
      pagine_lette: 1,
      ha_altre_pagine: true,
      prossima_pagina: 2,
      troncato_al_limite_pagine: false,
    });
    expect(testo(risultato)).toContain("richiedere pagina 2");
  });

  it("non segnala altre pagine quando la pagina letta è corta", async () => {
    api.setGestore(gestorePaginato(4, (i) => ({ descr: `Persona ${i}` })));
    await apri();
    const risultato = await chiama("domustudio_list_persone", { dimensione_pagina: 10 });

    expect(risultato.structuredContent).toMatchObject({
      ha_altre_pagine: false,
      troncato_al_limite_pagine: false,
    });
    expect(risultato.structuredContent).not.toHaveProperty("prossima_pagina");
    expect(testo(risultato)).toContain("Nessuna altra pagina");
  });

  it("con tutte_le_pagine scorre fino all'ultima pagina", async () => {
    api.setGestore(gestorePaginato(25, (i) => ({ descr: `Persona ${i}` })));
    await apri();
    const risultato = await chiama("domustudio_list_persone", {
      dimensione_pagina: 10,
      tutte_le_pagine: true,
    });

    expect(risultato.structuredContent).toMatchObject({
      conteggio: 25,
      pagine_lette: 3,
      ha_altre_pagine: false,
    });
    expect(api.richieste.map((r) => r.query.get("PageNumber"))).toEqual(["1", "2", "3"]);
  });

  it("segnala il troncamento solo quando tutte_le_pagine tocca il tetto", async () => {
    api.setGestore(gestorePaginato(MAX_PAGES_PER_CALL * 10 + 5, (i) => ({ descr: `Persona ${i}` })));
    await apri();
    const risultato = await chiama("domustudio_list_persone", {
      dimensione_pagina: 10,
      tutte_le_pagine: true,
    });

    expect(risultato.structuredContent).toMatchObject({
      conteggio: MAX_PAGES_PER_CALL * 10,
      pagine_lette: MAX_PAGES_PER_CALL,
      troncato_al_limite_pagine: true,
      ha_altre_pagine: true,
      prossima_pagina: 1 + MAX_PAGES_PER_CALL,
    });
  });

  it("parte dalla pagina richiesta", async () => {
    api.setGestore(gestorePaginato(100, (i) => ({ descr: `Persona ${i}` })));
    await apri();
    const risultato = await chiama("domustudio_list_persone", { pagina: 3, dimensione_pagina: 5 });

    expect(api.richieste[0]!.query.get("PageNumber")).toBe("3");
    expect(risultato.structuredContent).toMatchObject({ pagina: 3, prossima_pagina: 4 });
    expect(testo(risultato)).toContain("Persona 10");
  });

  it("riporta l'assenza di risultati nominando il condominio", async () => {
    api.setGestore((_req, res) => rispondiJson(res, []));
    await apri();
    const risultato = await chiama("domustudio_list_persone", { condominio_id: 42 });
    expect(risultato.structuredContent).toMatchObject({ conteggio: 0, ha_altre_pagine: false });
    expect(testo(risultato)).toContain("per il condominio 42");
  });

  it("rifiuta una dimensione di pagina fuori scala prima di chiamare l'API", async () => {
    await apri();
    const risultato = await chiama("domustudio_list_persone", { dimensione_pagina: 5000 });
    expect(risultato.isError).toBe(true);
    expect(testo(risultato)).toContain("dimensione_pagina");
    expect(api.richieste).toHaveLength(0);
  });

  it("trasforma un 401 in un errore dello strumento, non di protocollo", async () => {
    api.setGestore((_req, res) => rispondi401Troncato(res));
    await apri();
    const risultato = await chiama("domustudio_list_persone", { condominio_id: 1 });

    expect(risultato.isError).toBe(true);
    expect(testo(risultato)).toContain("X-DANEA-API-KEY");
    expect(testo(risultato)).toContain("desa");
  });
});

describe("domustudio_list_fornitori", () => {
  it("inoltra i filtri specifici dei fornitori", async () => {
    api.setGestore(gestorePaginato(2, (i) => ({ descr: `Fornitore ${i}` })));
    await apri();
    await chiama("domustudio_list_fornitori", {
      attivi: true,
      dati_incompleti: false,
      attivita: "Idraulico",
      impianto_servizio_id: 5,
      esercizi_id: [2023, 2024],
      search_query: "idra",
      order_by: "descr",
    });

    const query = api.richieste[0]!.query;
    expect(api.richieste[0]!.path).toBe("/api/external/fornitore");
    expect(query.get("Attivi")).toBe("true");
    expect(query.get("DatiIncompleti")).toBe("false");
    expect(query.get("Attivita")).toBe("Idraulico");
    expect(query.get("ImpiantoServizioID")).toBe("5");
    expect(query.getAll("EserciziID")).toEqual(["2023", "2024"]);
    expect(query.get("SearchQuery")).toBe("idra");
  });

  it("non inoltra i filtri non indicati", async () => {
    api.setGestore(gestorePaginato(1, () => ({ descr: "X" })));
    await apri();
    await chiama("domustudio_list_fornitori");

    const chiavi = [...api.richieste[0]!.query.keys()].sort();
    expect(chiavi).toEqual(["PageNumber", "PageSize"]);
  });

  it("decodifica gli enum del fornitore e marca gli inattivi", async () => {
    api.setGestore((_req, res) =>
      rispondiJson(res, [
        {
          descr: "Idraulica SRL",
          fornitoreAttivita: "Idraulico",
          f24CodTributo: 1038,
          causalePunto18770: 1,
          fornitoreInattivo: true,
        },
      ]),
    );
    await apri();
    const risultato = await chiama("domustudio_list_fornitori");

    const struttura = risultato.structuredContent as { elementi: Record<string, unknown>[] };
    expect(struttura.elementi[0]!["f24CodTributo"]).toEqual({ codice: 1038, etichetta: "1038" });
    expect(struttura.elementi[0]!["causalePunto18770"]).toEqual({ codice: 1, etichetta: "Tipo A" });
    expect(testo(risultato)).toContain("## Idraulica SRL — INATTIVO");
  });

  it("propaga un errore 500 persistente come errore dello strumento", async () => {
    api.setGestore((_req, res) => rispondiJson(res, { errore: "boom" }, 500));
    await apri();
    const risultato = await chiama("domustudio_list_fornitori");

    expect(risultato.isError).toBe(true);
    expect(testo(risultato)).toContain("HTTP 500");
    expect(api.richieste).toHaveLength(3);
  });
});
