import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { leggiFileEnv, risolviAmbiente } from "../src/env.js";
import { ConfigError } from "../src/errors.js";
import { cartellaTemporanea } from "./helpers/cartella.js";

const unArchivio = '[{"name":"desa","api_key":"k1"}]';

const cartella = cartellaTemporanea("domustudio-env-");
const scrivi = (nome: string, contenuto: string): string => cartella.scrivi(nome, contenuto);

describe("leggiFileEnv", () => {
  it("restituisce undefined se il file non esiste", () => {
    expect(leggiFileEnv(join(cartella.percorso, "assente"))).toBeUndefined();
  });

  it("legge le assegnazioni e ignora righe vuote e commenti", () => {
    const percorso = scrivi(
      ".env",
      ["# un commento", "", `DOMUSTUDIO_ARCHIVES=${unArchivio}`, "  ", "ALTRO=valore"].join("\n"),
    );
    expect(leggiFileEnv(percorso)).toEqual({
      DOMUSTUDIO_ARCHIVES: unArchivio,
      ALTRO: "valore",
    });
  });

  it("accetta il prefisso export e le virgolette", () => {
    const percorso = scrivi(".env", `export DOMUSTUDIO_ARCHIVES='${unArchivio}'\nB="due"\n`);
    expect(leggiFileEnv(percorso)).toEqual({ DOMUSTUDIO_ARCHIVES: unArchivio, B: "due" });
  });

  it("accetta un valore fra apici esteso su più righe", () => {
    const percorso = scrivi(
      ".env",
      ["DOMUSTUDIO_ARCHIVES='[", '  {"name":"desa","api_key":"k1"}', "]'", "DOPO=ok"].join("\n"),
    );
    const valori = leggiFileEnv(percorso)!;
    expect(JSON.parse(valori["DOMUSTUDIO_ARCHIVES"]!)).toEqual([{ name: "desa", api_key: "k1" }]);
    expect(valori["DOPO"]).toBe("ok");
  });

  it("non tocca un cancelletto dentro un valore", () => {
    const percorso = scrivi(".env", "DOMUSTUDIO_BASE_URL=http://host/api#frammento\n");
    expect(leggiFileEnv(percorso)).toEqual({
      DOMUSTUDIO_BASE_URL: "http://host/api#frammento",
    });
  });

  it.each([
    ["virgolette doppie attorno a JSON", `DOMUSTUDIO_ARCHIVES="${unArchivio}"\n`],
    ["testo dopo l'apice di chiusura", "A='uno'due\n"],
    ["testo dopo la chiusura di un valore su più righe", "A='uno\ndue' tre\n"],
    ["apice mai chiuso", "A='non chiuso\nB=due\nC=tre\n"],
  ])("rifiuta un valore troncabile invece di tagliarlo: %s", (_caso, contenuto) => {
    const percorso = scrivi(".env", contenuto);
    expect(() => leggiFileEnv(percorso)).toThrow(ConfigError);
  });

  it("nomina file e chiave senza mostrare il valore", () => {
    const segreto = "CHIAVE-DA-NON-MOSTRARE";
    const percorso = scrivi(".env", `DOMUSTUDIO_ARCHIVES="[{"name":"desa","api_key":"${segreto}"}]"\n`);
    try {
      leggiFileEnv(percorso);
      expect.unreachable();
    } catch (errore) {
      const messaggio = (errore as Error).message;
      expect(messaggio).toContain("DOMUSTUDIO_ARCHIVES");
      expect(messaggio).toContain(percorso);
      expect(messaggio).not.toContain(segreto);
    }
  });

  it("rifiuta un file che esiste ma non è leggibile", () => {
    const percorso = scrivi("illeggibile.env", "A=1\n");
    chmodSync(percorso, 0o000);
    try {
      expect(() => leggiFileEnv(percorso)).toThrow(ConfigError);
    } finally {
      chmodSync(percorso, 0o600);
    }
  });

  it("tratta una directory come illeggibile, non come assente", () => {
    mkdirSync(join(cartella.percorso, "cartella.env"));
    expect(() => leggiFileEnv(join(cartella.percorso, "cartella.env"))).toThrow(ConfigError);
  });
});

describe("risolviAmbiente", () => {
  it("legge .env dalla directory indicata", () => {
    const percorso = scrivi(".env", `DOMUSTUDIO_ARCHIVES=${unArchivio}\n`);
    const { ambiente, fileUsato } = risolviAmbiente({}, cartella.percorso);
    expect(ambiente["DOMUSTUDIO_ARCHIVES"]).toBe(unArchivio);
    expect(fileUsato).toBe(percorso);
  });

  it("lascia vincere l'ambiente reale sul file", () => {
    scrivi(".env", `DOMUSTUDIO_ARCHIVES=${unArchivio}\nDOMUSTUDIO_BASE_URL=http://dal-file/\n`);
    const { ambiente } = risolviAmbiente({ DOMUSTUDIO_BASE_URL: "http://dall-ambiente/" }, cartella.percorso);
    expect(ambiente["DOMUSTUDIO_BASE_URL"]).toBe("http://dall-ambiente/");
    expect(ambiente["DOMUSTUDIO_ARCHIVES"]).toBe(unArchivio);
  });

  it("tace se .env non esiste", () => {
    const { ambiente, fileUsato } = risolviAmbiente({ DOMUSTUDIO_ARCHIVES: unArchivio }, cartella.percorso);
    expect(fileUsato).toBeUndefined();
    expect(ambiente["DOMUSTUDIO_ARCHIVES"]).toBe(unArchivio);
  });

  it("segue DOMUSTUDIO_ENV_FILE verso un altro file", () => {
    const percorso = scrivi("credenziali.env", `DOMUSTUDIO_ARCHIVES=${unArchivio}\n`);
    scrivi(".env", 'DOMUSTUDIO_ARCHIVES=[{"name":"sbagliato","api_key":"x"}]\n');
    const { ambiente, fileUsato } = risolviAmbiente(
      { DOMUSTUDIO_ENV_FILE: "credenziali.env" },
      cartella.percorso,
    );
    expect(ambiente["DOMUSTUDIO_ARCHIVES"]).toBe(unArchivio);
    expect(fileUsato).toBe(percorso);
  });

  it("salta la lettura se DOMUSTUDIO_ENV_FILE è vuoto", () => {
    scrivi(".env", `DOMUSTUDIO_ARCHIVES=${unArchivio}\n`);
    const { ambiente, fileUsato } = risolviAmbiente({ DOMUSTUDIO_ENV_FILE: "" }, cartella.percorso);
    expect(ambiente["DOMUSTUDIO_ARCHIVES"]).toBeUndefined();
    expect(fileUsato).toBeUndefined();
  });

  it("segnala un DOMUSTUDIO_ENV_FILE illeggibile", () => {
    expect(() => risolviAmbiente({ DOMUSTUDIO_ENV_FILE: "assente.env" }, cartella.percorso)).toThrow(
      ConfigError,
    );
  });
});
