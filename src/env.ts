import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_ENV_FILE, ENV_FILE_ENV_VAR } from "./constants.js";
import { ConfigError } from "./errors.js";

const RIGA_ASSEGNAZIONE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

function valoreAmbiguo(chiave: string, percorso: string): ConfigError {
  return new ConfigError(
    `${chiave} in ${percorso}: c'è altro testo dopo la virgoletta di chiusura. ` +
      `Un valore che contiene virgolette va racchiuso fra apici singoli.`,
  );
}

/**
 * Values of a `KEY=value` file, or `undefined` when the file cannot be read.
 *
 * A value may be quoted with `'` or `"`, and a quoted value may span several lines; an
 * unquoted value ends at the newline. Throws `ConfigError` when anything but whitespace
 * follows the closing quote, rather than truncating the value there.
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
      if (grezzo.slice(chiusura + 1).trim() !== "") throw valoreAmbiguo(chiave, percorso);
      valori[chiave] = grezzo.slice(1, chiusura);
      continue;
    }

    const pezzi = [grezzo.slice(1)];
    while (++i < righe.length) {
      const successiva = righe[i]!;
      const fine = successiva.indexOf(apice);
      if (fine >= 0) {
        if (successiva.slice(fine + 1).trim() !== "") throw valoreAmbiguo(chiave, percorso);
        pezzi.push(successiva.slice(0, fine));
        break;
      }
      pezzi.push(successiva);
    }
    valori[chiave] = pezzi.join("\n");
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
 * lookup, and real environment variables win over the file.
 *
 * Throws `ConfigError` when `DOMUSTUDIO_ENV_FILE` names a file that cannot be read; a
 * missing `.env` is silent. See docs/adr/0005-credentials-from-an-env-file.md.
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
