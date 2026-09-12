import {
  ARCHIVES_ENV_VAR,
  BASE_URL_ENV_VAR,
  DEFAULT_BASE_URL,
  ENV_FILE_ENV_VAR,
} from "./constants.js";
import { ConfigError } from "./errors.js";

const VARIABILE_NON_ESPANSA = /^\$\{[^}]*\}$/;

export interface ArchiveConfig {
  name: string;
  apiKey: string;
}

export interface ServerConfig {
  baseUrl: string;
  archives: ArchiveConfig[];
}

/**
 * Read configuration from the environment.
 *
 * `DOMUSTUDIO_ARCHIVES` is a JSON array of `{"name", "api_key"}` objects: one API key
 * addresses exactly one Domustudio archive, and several archives may coexist.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const raw = env[ARCHIVES_ENV_VAR]?.trim();
  if (!raw) {
    throw new ConfigError(
      `Variabile d'ambiente ${ARCHIVES_ENV_VAR} mancante. ` +
        `Attesa una lista JSON di archivi, es. ` +
        `${ARCHIVES_ENV_VAR}='[{"name":"desa","api_key":"..."}]'`,
    );
  }

  if (VARIABILE_NON_ESPANSA.test(raw)) {
    throw new ConfigError(
      `${ARCHIVES_ENV_VAR} vale ancora "${raw}": il client non ha espanso la variabile. ` +
        `Togliere il blocco "env" dalla configurazione del client e mettere la chiave in un file ` +
        `.env nella directory di lavoro del server, oppure indicarlo con ${ENV_FILE_ENV_VAR}.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new ConfigError(
      `${ARCHIVES_ENV_VAR} non è JSON valido: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new ConfigError(
      `${ARCHIVES_ENV_VAR} deve essere una lista JSON non vuota di oggetti {"name", "api_key"}.`,
    );
  }

  const archives: ArchiveConfig[] = parsed.map((voce, indice) => {
    if (typeof voce !== "object" || voce === null || Array.isArray(voce)) {
      throw new ConfigError(`${ARCHIVES_ENV_VAR}[${indice}] non è un oggetto JSON.`);
    }
    const record = voce as Record<string, unknown>;
    const name = record["name"] ?? record["nome"];
    const apiKey = record["api_key"] ?? record["apiKey"];
    if (typeof name !== "string" || name.trim() === "") {
      throw new ConfigError(`${ARCHIVES_ENV_VAR}[${indice}].name mancante o non valido.`);
    }
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      throw new ConfigError(
        `${ARCHIVES_ENV_VAR}[${indice}].api_key mancante o non valido (archivio "${name}").`,
      );
    }
    return { name: name.trim(), apiKey: apiKey.trim() };
  });

  const nomi = new Set<string>();
  for (const archivio of archives) {
    if (nomi.has(archivio.name)) {
      throw new ConfigError(`${ARCHIVES_ENV_VAR} contiene due archivi con lo stesso nome "${archivio.name}".`);
    }
    nomi.add(archivio.name);
  }

  return {
    baseUrl: env[BASE_URL_ENV_VAR]?.trim() || DEFAULT_BASE_URL,
    archives,
  };
}
