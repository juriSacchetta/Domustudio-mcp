import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_ENV_FILE, ENV_FILE_ENV_VAR } from "./constants.js";
import { ConfigError } from "./errors.js";

const RIGA_ASSEGNAZIONE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

/**
 * Values of a `KEY=value` file, or `undefined` when the file cannot be read.
 *
 * A value may be quoted with `'` or `"`, and a quoted value may span several lines; an
 * unquoted value ends at the newline. Throws `ConfigError` naming the file and the key,
 * never the value, when a quote is never closed or anything but whitespace follows the
 * closing one.
 */
export function leggiFileEnv(percorso: string): Record<string, string> | undefined {
  let contenuto: string;
  try {
    contenuto = readFileSync(percorso, "utf8");
  } catch {
    return undefined;
  }

  const valori: Record<string, string> = {};
  const righe = contenuto.split("\n");

  function ambiguo(chiave: string): ConfigError {
    return new ConfigError(
      `${chiave} in ${percorso}: c'è altro testo dopo la virgoletta di chiusura. ` +
        `Un valore che contiene virgolette va racchiuso fra apici singoli.`,
    );
  }

  /** Returns the value and the index of its last line; the caller resumes after it. */
  function valoreEsteso(
    inizio: number,
    primoPezzo: string,
    apice: string,
    chiave: string,
  ): { valore: string; ultimaRiga: number } {
    const pezzi = [primoPezzo];
    for (let i = inizio + 1; i < righe.length; i++) {
      const riga = righe[i]!;
      const fine = riga.indexOf(apice);
      if (fine < 0) {
        pezzi.push(riga);
        continue;
      }
      if (riga.slice(fine + 1).trim() !== "") throw ambiguo(chiave);
      pezzi.push(riga.slice(0, fine));
      return { valore: pezzi.join("\n"), ultimaRiga: i };
    }
    throw new ConfigError(
      `${chiave} in ${percorso}: la virgoletta di apertura non viene mai chiusa.`,
    );
  }

  for (let i = 0; i < righe.length; i++) {
    const riga = righe[i]!.trim();
    if (!riga || riga.startsWith("#")) continue;

    const assegnazione = RIGA_ASSEGNAZIONE.exec(riga);
    if (!assegnazione) continue;
    const chiave = assegnazione[1]!;

    const grezzo = assegnazione[2]!.trim();
    const apice = grezzo.startsWith("'") || grezzo.startsWith('"') ? grezzo[0]! : undefined;
    if (apice === undefined) {
      valori[chiave] = grezzo;
      continue;
    }

    const chiusura = grezzo.indexOf(apice, 1);
    if (chiusura >= 0) {
      if (grezzo.slice(chiusura + 1).trim() !== "") throw ambiguo(chiave);
      valori[chiave] = grezzo.slice(1, chiusura);
      continue;
    }

    const esteso = valoreEsteso(i, grezzo.slice(1), apice, chiave);
    valori[chiave] = esteso.valore;
    i = esteso.ultimaRiga;
  }

  return valori;
}

export interface AmbienteRisolto {
  ambiente: NodeJS.ProcessEnv;
  fileUsato?: string;
}

/**
 * The process environment, backed by a `KEY=value` file: the one named by
 * `DOMUSTUDIO_ENV_FILE`, or `.env` in `cwd`. An empty `DOMUSTUDIO_ENV_FILE` skips the
 * lookup, real environment variables win over the file, and an unreadable
 * `DOMUSTUDIO_ENV_FILE` throws `ConfigError` where a missing `.env` is silent.
 *
 * See docs/adr/0005-credentials-from-an-env-file.md.
 */
export function risolviAmbiente(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): AmbienteRisolto {
  const indicato = env[ENV_FILE_ENV_VAR]?.trim();
  if (indicato === "") return { ambiente: env };

  const percorso = resolve(cwd, indicato ?? DEFAULT_ENV_FILE);
  const dalFile = leggiFileEnv(percorso);
  if (dalFile === undefined) {
    if (indicato !== undefined) {
      throw new ConfigError(`${ENV_FILE_ENV_VAR} indica "${percorso}", che non è leggibile.`);
    }
    return { ambiente: env };
  }

  return { ambiente: { ...dalFile, ...env }, fileUsato: percorso };
}
