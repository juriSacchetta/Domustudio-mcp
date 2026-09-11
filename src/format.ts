import { CHARACTER_LIMIT } from "./constants.js";

export const RESPONSE_FORMATS = ["markdown", "json"] as const;
export type ResponseFormat = (typeof RESPONSE_FORMATS)[number];

type Record_ = Record<string, unknown>;

function testo(valore: unknown): string | undefined {
  if (valore === undefined || valore === null) return undefined;
  if (typeof valore === "string") return valore.trim() === "" ? undefined : valore.trim();
  if (typeof valore === "number" || typeof valore === "boolean") return String(valore);
  if (Array.isArray(valore)) {
    const parti = valore.map(testo).filter((v): v is string => v !== undefined);
    return parti.length ? parti.join(", ") : undefined;
  }
  if (typeof valore === "object") {
    const etichetta = (valore as Record_)["etichetta"];
    if (typeof etichetta === "string") return etichetta;
  }
  return undefined;
}

function riga(etichetta: string, valore: unknown): string | undefined {
  const v = testo(valore);
  return v === undefined ? undefined : `- **${etichetta}:** ${v}`;
}

function indirizzo(record: Record_): string | undefined {
  const via = testo(record["indirizzo"]);
  const localita = [testo(record["cap"]), testo(record["citta"])].filter(Boolean).join(" ");
  const prov = testo(record["prov"]);
  const parti = [via, localita || undefined, prov ? `(${prov})` : undefined].filter(
    (x): x is string => x !== undefined,
  );
  return parti.length ? parti.join(", ") : undefined;
}

function blocco(titolo: string, righe: (string | undefined)[]): string {
  return [`## ${titolo}`, ...righe.filter((r): r is string => r !== undefined)].join("\n");
}

export function condominioMarkdown(record: Record_): string {
  const amministratore = record["amministratore"];
  const nomeAmm =
    amministratore && typeof amministratore === "object"
      ? testo((amministratore as Record_)["nome"])
      : undefined;
  return blocco(`${testo(record["intestazione"]) ?? "(senza intestazione)"} — id ${testo(record["id"]) ?? "?"}`, [
    riga("Indirizzo", indirizzo(record)),
    riga("Codice fiscale", record["codFisc"]),
    riga("Amministratore", nomeAmm),
  ]);
}

export function personaMarkdown(record: Record_): string {
  return blocco(testo(record["descr"]) ?? "(senza denominazione)", [
    riga("Titolo", record["titolo"]),
    riga("Codice fiscale", record["codFisc"]),
    riga("Partita IVA", record["piva"]),
    riga("Indirizzo", indirizzo(record)),
    riga("Email", record["email"]),
    riga("PEC", record["pec"]),
    riga("Telefono", [record["tel1"], record["tel2"], record["tel3"]]),
    riga("Preferenza pagamento rate", record["preferenzaPagamentoRate"]),
  ]);
}

export function fornitoreMarkdown(record: Record_): string {
  const inattivo = record["fornitoreInattivo"] === true;
  return blocco(`${testo(record["descr"]) ?? "(senza denominazione)"}${inattivo ? " — INATTIVO" : ""}`, [
    riga("Attività", record["fornitoreAttivita"]),
    riga("Codice fiscale", record["codFisc"]),
    riga("Partita IVA", record["piva"]),
    riga("Indirizzo", indirizzo(record)),
    riga("Email", record["email"]),
    riga("PEC", record["pec"]),
    riga("Telefono", [record["tel1"], record["tel2"], record["tel3"]]),
    riga("IBAN", record["iban"]),
    riga("Stato DURC", record["descStatoDurc"]),
  ]);
}

/** Truncates on a line boundary and appends a notice naming the limit. */
export function troncaTesto(contenuto: string, limite: number = CHARACTER_LIMIT): string {
  if (contenuto.length <= limite) return contenuto;
  const avviso = `\n\n_[Output troncato a ${limite} caratteri: restringere la richiesta con un filtro o una pagina più piccola. I dati completi restano in structuredContent.]_`;
  const taglio = contenuto.slice(0, Math.max(0, limite - avviso.length));
  const ultimaRiga = taglio.lastIndexOf("\n");
  return (ultimaRiga > 0 ? taglio.slice(0, ultimaRiga) : taglio) + avviso;
}
