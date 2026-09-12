import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { ConfigError } from "../src/errors.js";
import { ArchiveRegistry, ArchivioSconosciutoError } from "../src/registry.js";
import { DEFAULT_BASE_URL } from "../src/constants.js";

const unArchivio = '[{"name":"desa","api_key":"k1"}]';

describe("loadConfig", () => {
  it("legge la lista di archivi e usa la base URL HTTPS di default", () => {
    const config = loadConfig({ DOMUSTUDIO_ARCHIVES: unArchivio });
    expect(config.archives).toEqual([{ name: "desa", apiKey: "k1" }]);
    expect(config.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(config.baseUrl.startsWith("https://")).toBe(true);
  });

  it("accetta più archivi e permette di sovrascrivere la base URL", () => {
    const config = loadConfig({
      DOMUSTUDIO_ARCHIVES: '[{"name":"desa","api_key":"k1"},{"name":"altro","api_key":"k2"}]',
      DOMUSTUDIO_BASE_URL: "http://127.0.0.1:9999/api/external",
    });
    expect(config.archives.map((a) => a.name)).toEqual(["desa", "altro"]);
    expect(config.baseUrl).toBe("http://127.0.0.1:9999/api/external");
  });

  it("non rimanda indietro il valore quando il JSON non è valido", () => {
    expect(() => loadConfig({ DOMUSTUDIO_ARCHIVES: "sk-live-SEGRETISSIMO" })).toThrow(
      /non è JSON valido/,
    );
    try {
      loadConfig({ DOMUSTUDIO_ARCHIVES: "sk-live-SEGRETISSIMO" });
    } catch (errore) {
      expect((errore as Error).message).not.toContain("SEGRET");
    }
  });

  it("riconosce una variabile non espansa dal client MCP", () => {
    expect(() => loadConfig({ DOMUSTUDIO_ARCHIVES: "${DOMUSTUDIO_ARCHIVES}" })).toThrow(
      /non ha espanso la variabile/,
    );
  });

  it("accetta anche le chiavi camelCase e nome", () => {
    const config = loadConfig({ DOMUSTUDIO_ARCHIVES: '[{"nome":"desa","apiKey":"k1"}]' });
    expect(config.archives).toEqual([{ name: "desa", apiKey: "k1" }]);
  });

  it.each([
    ["variabile assente", {}],
    ["variabile vuota", { DOMUSTUDIO_ARCHIVES: "   " }],
    ["JSON non valido", { DOMUSTUDIO_ARCHIVES: "{non json" }],
    ["lista vuota", { DOMUSTUDIO_ARCHIVES: "[]" }],
    ["non una lista", { DOMUSTUDIO_ARCHIVES: '{"name":"desa","api_key":"k"}' }],
    ["voce non oggetto", { DOMUSTUDIO_ARCHIVES: '["desa"]' }],
    ["nome mancante", { DOMUSTUDIO_ARCHIVES: '[{"api_key":"k"}]' }],
    ["chiave mancante", { DOMUSTUDIO_ARCHIVES: '[{"name":"desa"}]' }],
    ["chiave vuota", { DOMUSTUDIO_ARCHIVES: '[{"name":"desa","api_key":"  "}]' }],
    [
      "nomi duplicati",
      { DOMUSTUDIO_ARCHIVES: '[{"name":"desa","api_key":"a"},{"name":"desa","api_key":"b"}]' },
    ],
  ])("rifiuta la configurazione: %s", (_caso, env) => {
    expect(() => loadConfig(env as NodeJS.ProcessEnv)).toThrow(ConfigError);
  });

  it("nomina la variabile d'ambiente nel messaggio d'errore", () => {
    expect(() => loadConfig({})).toThrow(/DOMUSTUDIO_ARCHIVES/);
  });
});

describe("ArchiveRegistry", () => {
  it("usa l'unico archivio configurato quando il parametro è omesso", () => {
    const registry = new ArchiveRegistry(loadConfig({ DOMUSTUDIO_ARCHIVES: unArchivio }));
    expect(registry.resolve().archivio).toBe("desa");
    expect(registry.resolve("desa").archivio).toBe("desa");
    expect(registry.names).toEqual(["desa"]);
  });

  it("pretende il nome quando gli archivi sono più di uno, elencandoli nell'errore", () => {
    const registry = new ArchiveRegistry(
      loadConfig({
        DOMUSTUDIO_ARCHIVES: '[{"name":"desa","api_key":"k1"},{"name":"altro","api_key":"k2"}]',
      }),
    );
    expect(() => registry.resolve()).toThrow(ArchivioSconosciutoError);
    expect(() => registry.resolve()).toThrow(/desa, altro/);
    expect(registry.resolve("altro").archivio).toBe("altro");
  });

  it("segnala un archivio inesistente elencando quelli disponibili", () => {
    const registry = new ArchiveRegistry(loadConfig({ DOMUSTUDIO_ARCHIVES: unArchivio }));
    expect(() => registry.resolve("mancante")).toThrow(/Archivio "mancante" non configurato.*desa/s);
  });
});
