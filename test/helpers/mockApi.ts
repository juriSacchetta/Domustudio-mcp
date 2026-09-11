import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface RichiestaRegistrata {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string | string[] | undefined>;
}

export type Gestore = (
  req: IncomingMessage,
  res: ServerResponse,
  richiesta: RichiestaRegistrata,
) => void;

export interface MockApi {
  baseUrl: string;
  richieste: RichiestaRegistrata[];
  setGestore(gestore: Gestore): void;
  close(): Promise<void>;
}

export function rispondiJson(res: ServerResponse, payload: unknown, status = 200): void {
  const corpo = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(corpo);
}

/** Answers with a 401 whose chunked body is cut mid-object, as Kestrel does. */
export function rispondi401Troncato(res: ServerResponse): void {
  res.writeHead(401, { "content-type": "application/json", "transfer-encoding": "chunked" });
  res.write('{"messag', () => {
    setTimeout(() => res.socket?.destroy(), 10);
  });
}

export async function avviaMockApi(gestoreIniziale?: Gestore): Promise<MockApi> {
  const richieste: RichiestaRegistrata[] = [];
  let gestore: Gestore = gestoreIniziale ?? ((_req, res) => rispondiJson(res, []));

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const richiesta: RichiestaRegistrata = {
      method: req.method ?? "GET",
      path: url.pathname,
      query: url.searchParams,
      headers: req.headers,
    };
    richieste.push(richiesta);
    gestore(req, res, richiesta);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const porta = (server.address() as AddressInfo).port;

  return {
    baseUrl: `http://127.0.0.1:${porta}/api/external`,
    richieste,
    setGestore(nuovo: Gestore) {
      gestore = nuovo;
    },
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}

/** Serves `totale` synthetic records, honouring PageNumber/PageSize the way the API does. */
export function gestorePaginato(
  totale: number,
  fabbrica: (indice: number) => Record<string, unknown>,
): Gestore {
  return (_req, res, richiesta) => {
    const pagina = Number(richiesta.query.get("PageNumber") ?? "1");
    const dimensione = Number(richiesta.query.get("PageSize") ?? "50");
    const inizio = (pagina - 1) * dimensione;
    const elementi = Array.from({ length: totale }, (_, i) => fabbrica(i)).slice(
      inizio,
      inizio + dimensione,
    );
    rispondiJson(res, elementi);
  };
}
