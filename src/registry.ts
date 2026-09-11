import { DomustudioClient } from "./domustudio/client.js";
import type { ClientOptions } from "./domustudio/client.js";
import type { ServerConfig } from "./config.js";

export class ArchivioSconosciutoError extends Error {
  constructor(richiesto: string | undefined, disponibili: readonly string[]) {
    super(
      richiesto === undefined
        ? `Parametro "archivio" obbligatorio: sono configurati più archivi Domustudio (${disponibili.join(", ")}).`
        : `Archivio "${richiesto}" non configurato. Archivi disponibili: ${disponibili.join(", ")}.`,
    );
    this.name = "ArchivioSconosciutoError";
  }
}

/** One client per configured archive; `resolve` defaults to the only archive when just one exists. */
export class ArchiveRegistry {
  private readonly clients = new Map<string, DomustudioClient>();

  constructor(config: ServerConfig, overrides: Partial<ClientOptions> = {}) {
    for (const archivio of config.archives) {
      this.clients.set(
        archivio.name,
        new DomustudioClient(archivio.name, archivio.apiKey, {
          baseUrl: config.baseUrl,
          ...overrides,
        }),
      );
    }
  }

  get names(): string[] {
    return [...this.clients.keys()];
  }

  resolve(archivio?: string): DomustudioClient {
    if (archivio === undefined || archivio === "") {
      if (this.clients.size === 1) {
        return [...this.clients.values()][0]!;
      }
      throw new ArchivioSconosciutoError(undefined, this.names);
    }
    const client = this.clients.get(archivio);
    if (!client) throw new ArchivioSconosciutoError(archivio, this.names);
    return client;
  }
}
