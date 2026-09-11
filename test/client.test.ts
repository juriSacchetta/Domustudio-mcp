import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomustudioClient, buildSearchParams } from "../src/domustudio/client.js";
import {
  DomustudioAuthError,
  DomustudioNetworkError,
  DomustudioRequestError,
} from "../src/errors.js";
import {
  avviaMockApi,
  gestorePaginato,
  rispondi401Troncato,
  rispondiJson,
} from "./helpers/mockApi.js";
import type { MockApi } from "./helpers/mockApi.js";

let api: MockApi;

beforeEach(async () => {
  api = await avviaMockApi();
});

afterEach(async () => {
  await api.close();
});

function client(overrides: Partial<ConstructorParameters<typeof DomustudioClient>[2]> = {}) {
  return new DomustudioClient("desa", "chiave-segreta", {
    baseUrl: api.baseUrl,
    retryBaseDelayMs: 1,
    ...overrides,
  });
}

describe("buildSearchParams", () => {
  it("ripete la chiave per ogni elemento di un array", () => {
    const params = buildSearchParams({ TagsID: [1, 2, 3] });
    expect(params.getAll("TagsID")).toEqual(["1", "2", "3"]);
    expect(params.toString()).toBe("TagsID=1&TagsID=2&TagsID=3");
  });

  it("omette undefined e null, serializza i booleani", () => {
    const params = buildSearchParams({ a: undefined, b: null, Attivi: true, N: 0 });
    expect(params.toString()).toBe("Attivi=true&N=0");
  });
});

describe("DomustudioClient.get", () => {
  it("invia la chiave API e la versione su ogni chiamata", async () => {
    api.setGestore((_req, res) => rispondiJson(res, [{ id: 1 }]));
    await client().get("condominio");

    const richiesta = api.richieste[0]!;
    expect(richiesta.path).toBe("/api/external/condominio");
    expect(richiesta.headers["x-danea-api-key"]).toBe("chiave-segreta");
    expect(richiesta.headers["x-api-version"]).toBe("1.0");
  });

  it("invia x-api-version una sola volta", async () => {
    api.setGestore((_req, res) => rispondiJson(res, []));
    await client().get("condominio");
    expect(api.richieste[0]!.headers["x-api-version"]).toBe("1.0");
  });

  it("normalizza una risposta oggetto in lista e scarta i non-oggetti", async () => {
    api.setGestore((_req, res) => rispondiJson(res, { id: 7 }));
    expect(await client().get("condominio")).toEqual([{ id: 7 }]);

    api.setGestore((_req, res) => rispondiJson(res, [1, "x", { id: 2 }]));
    expect(await client().get("condominio")).toEqual([{ id: 2 }]);
  });

  it("non tocca il corpo di un 401 troncato e solleva un errore di autenticazione", async () => {
    api.setGestore((_req, res) => rispondi401Troncato(res));

    const errore = await client().get("persona").catch((e: unknown) => e);
    expect(errore).toBeInstanceOf(DomustudioAuthError);
    expect((errore as DomustudioAuthError).message).toContain("desa");
    expect((errore as DomustudioAuthError).message).toContain("X-DANEA-API-KEY");
    expect(api.richieste).toHaveLength(1);
  });

  it("non ritenta un 404", async () => {
    api.setGestore((_req, res) => rispondiJson(res, { errore: "assente" }, 404));

    const errore = await client().get("persona").catch((e: unknown) => e);
    expect(errore).toBeInstanceOf(DomustudioRequestError);
    expect((errore as DomustudioRequestError).status).toBe(404);
    expect(api.richieste).toHaveLength(1);
  });

  it("ritenta un 500 e restituisce il successo successivo", async () => {
    let chiamate = 0;
    api.setGestore((_req, res) => {
      chiamate++;
      if (chiamate < 3) return rispondiJson(res, { errore: "boom" }, 503);
      return rispondiJson(res, [{ id: 1 }]);
    });

    expect(await client().get("condominio")).toEqual([{ id: 1 }]);
    expect(api.richieste).toHaveLength(3);
  });

  it("si arrende dopo maxAttempts su 5xx persistente", async () => {
    api.setGestore((_req, res) => rispondiJson(res, { errore: "boom" }, 500));

    const errore = await client().get("condominio").catch((e: unknown) => e);
    expect(errore).toBeInstanceOf(DomustudioRequestError);
    expect(api.richieste).toHaveLength(3);
  });

  it("ritenta gli errori di trasporto e li riporta come errore di rete", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const errore = await client({ fetchImpl }).get("condominio").catch((e: unknown) => e);

    expect(errore).toBeInstanceOf(DomustudioNetworkError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("rispetta un maxAttempts personalizzato", async () => {
    api.setGestore((_req, res) => rispondiJson(res, {}, 500));
    await client({ maxAttempts: 1 }).get("condominio").catch(() => undefined);
    expect(api.richieste).toHaveLength(1);
  });

  it("interrompe una risposta oltre il timeout", async () => {
    api.setGestore(() => {
      /* nessuna risposta: lascia scadere il timeout */
    });
    const errore = await client({ timeoutMs: 50, maxAttempts: 1 })
      .get("condominio")
      .catch((e: unknown) => e);
    expect(errore).toBeInstanceOf(DomustudioNetworkError);
  });
});

describe("DomustudioClient.getPages", () => {
  it("chiede PageNumber 1-based e si ferma su una pagina corta", async () => {
    api.setGestore(gestorePaginato(7, (i) => ({ descr: `persona ${i}` })));

    const esito = await client().getPages("persona", {}, 1, 3, 50);

    expect(esito.elementi).toHaveLength(7);
    expect(esito.pagineLette).toBe(3);
    expect(esito.troncato).toBe(false);
    expect(api.richieste.map((r) => r.query.get("PageNumber"))).toEqual(["1", "2", "3"]);
    expect(api.richieste[0]!.query.get("PageSize")).toBe("3");
  });

  it("si ferma su una pagina vuota quando il totale è multiplo esatto", async () => {
    api.setGestore(gestorePaginato(6, (i) => ({ descr: `persona ${i}` })));

    const esito = await client().getPages("persona", {}, 1, 3, 50);

    expect(esito.elementi).toHaveLength(6);
    expect(esito.pagineLette).toBe(3);
    expect(esito.troncato).toBe(false);
  });

  it("legge una sola pagina quando maxPages è 1 e segnala il troncamento", async () => {
    api.setGestore(gestorePaginato(100, (i) => ({ descr: `persona ${i}` })));

    const esito = await client().getPages("persona", {}, 2, 10, 1);

    expect(esito.elementi).toHaveLength(10);
    expect(esito.pagineLette).toBe(1);
    expect(esito.troncato).toBe(true);
    expect(api.richieste[0]!.query.get("PageNumber")).toBe("2");
  });

  it("inoltra i filtri su ogni pagina", async () => {
    api.setGestore(gestorePaginato(5, (i) => ({ descr: `p${i}` })));

    await client().getPages("persona", { CondGendID: 42, FiltroSubentri: 2 }, 1, 2, 50);

    for (const richiesta of api.richieste) {
      expect(richiesta.query.get("CondGendID")).toBe("42");
      expect(richiesta.query.get("FiltroSubentri")).toBe("2");
    }
  });
});
