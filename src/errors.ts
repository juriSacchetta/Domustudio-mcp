export class DomustudioError extends Error {
  constructor(
    message: string,
    readonly archivio: string,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class DomustudioAuthError extends DomustudioError {
  constructor(archivio: string, endpoint: string, readonly status: number) {
    super(
      `Autenticazione rifiutata dall'API Domustudio (HTTP ${status}) per l'archivio "${archivio}". ` +
        `Verificare la chiave X-DANEA-API-KEY configurata per questo archivio.`,
      archivio,
      endpoint,
    );
  }
}

export class DomustudioRequestError extends DomustudioError {
  constructor(
    archivio: string,
    endpoint: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(
      `L'API Domustudio ha risposto HTTP ${status} su ${endpoint} (archivio "${archivio}")` +
        (body ? `: ${body}` : "."),
      archivio,
      endpoint,
    );
  }
}

export class DomustudioNetworkError extends DomustudioError {
  constructor(archivio: string, endpoint: string, readonly causa: unknown) {
    super(
      `Impossibile contattare l'API Domustudio su ${endpoint} (archivio "${archivio}"): ` +
        `${causa instanceof Error ? causa.message : String(causa)}`,
      archivio,
      endpoint,
    );
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
