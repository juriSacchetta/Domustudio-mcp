import {
  API_VERSION,
  MAX_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  RETRY_BASE_DELAY_MS,
} from "../constants.js";
import {
  DomustudioAuthError,
  DomustudioNetworkError,
  DomustudioRequestError,
} from "../errors.js";

export type QueryValue = string | number | boolean | readonly (string | number)[] | undefined | null;
export type QueryParams = Readonly<Record<string, QueryValue>>;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Array values are repeated keys (`TagsID=1&TagsID=2`), which is what ASP.NET model binding expects. */
export function buildSearchParams(params: QueryParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [chiave, valore] of Object.entries(params)) {
    if (valore === undefined || valore === null) continue;
    if (Array.isArray(valore)) {
      for (const elemento of valore) search.append(chiave, String(elemento));
    } else {
      search.append(chiave, String(valore));
    }
  }
  return search;
}

function isRetryableStatus(status: number): boolean {
  return status >= 500;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Read-only HTTP client for one Domustudio archive.
 *
 * Retries 5xx and transport failures only; 4xx is never retried.
 */
export class DomustudioClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    readonly archivio: string,
    private readonly apiKey: string,
    options: ClientOptions,
  ) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? RETRY_BASE_DELAY_MS;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async get(endpoint: string, params: QueryParams = {}): Promise<Record<string, unknown>[]> {
    const search = buildSearchParams(params);
    const query = search.toString();
    const url = `${this.baseUrl}/${endpoint}${query ? `?${query}` : ""}`;

    let ultimoErrore: unknown;
    for (let tentativo = 1; tentativo <= this.maxAttempts; tentativo++) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            "X-DANEA-API-KEY": this.apiKey,
            "x-api-version": API_VERSION,
            accept: "application/json",
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (cause) {
        ultimoErrore = new DomustudioNetworkError(this.archivio, endpoint, cause);
        if (tentativo === this.maxAttempts) throw ultimoErrore;
        await this.sleep(this.retryBaseDelayMs * 2 ** (tentativo - 1));
        continue;
      }

      // Kestrel answers 401 with a truncated chunked body: the status must be
      // classified before the body is touched, or the parse error masks it.
      if (response.status === 401 || response.status === 403) {
        throw new DomustudioAuthError(this.archivio, endpoint, response.status);
      }

      if (!response.ok) {
        if (isRetryableStatus(response.status) && tentativo < this.maxAttempts) {
          ultimoErrore = new DomustudioRequestError(this.archivio, endpoint, response.status, "");
          await this.sleep(this.retryBaseDelayMs * 2 ** (tentativo - 1));
          continue;
        }
        throw new DomustudioRequestError(
          this.archivio,
          endpoint,
          response.status,
          await safeBody(response),
        );
      }

      return normalizeList(await response.json());
    }

    throw ultimoErrore ?? new DomustudioNetworkError(this.archivio, endpoint, "nessun tentativo eseguito");
  }

  /**
   * Fetch consecutive 1-based pages until `maxPages` is reached or a page comes back short.
   *
   * Returns `troncato: true` when the page cap stopped a run that had more data.
   */
  async getPages(
    endpoint: string,
    params: QueryParams,
    primaPagina: number,
    dimensionePagina: number,
    maxPages: number,
  ): Promise<{ elementi: Record<string, unknown>[]; pagineLette: number; troncato: boolean }> {
    const elementi: Record<string, unknown>[] = [];
    let pagineLette = 0;

    for (let offset = 0; offset < maxPages; offset++) {
      const pagina = primaPagina + offset;
      const lotto = await this.get(endpoint, {
        ...params,
        PageNumber: pagina,
        PageSize: dimensionePagina,
      });
      pagineLette++;
      elementi.push(...lotto);
      if (lotto.length < dimensionePagina) {
        return { elementi, pagineLette, troncato: false };
      }
    }

    return { elementi, pagineLette, troncato: true };
  }
}

async function safeBody(response: Response): Promise<string> {
  try {
    const testo = await response.text();
    return testo.slice(0, 500);
  } catch {
    return "";
  }
}

function normalizeList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }
  if (isRecord(payload)) return [payload];
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
