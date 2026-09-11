export interface CodiceEtichetta {
  codice: number;
  etichetta: string;
}

export type EnumMap = Readonly<Record<number, string>>;

export const FILTRO_SUBENTRI: EnumMap = {
  1: "Tutti",
  2: "Attivi",
  3: "Ex",
  4: "Contabilità",
  5: "Destinatari comunicazioni",
};

export const PREFERENZA_PAGAMENTO_RATE: EnumMap = {
  1: "Qualsiasi",
  2: "Bollettino di pagamento",
  3: "Bollettino postale",
  4: "MAV",
  5: "Bollettino Freccia",
  6: "Nessuno",
  7: "Bollettino PIGC",
  8: "MultiMAV",
};

export const PREFERENZA_INVIO: EnumMap = {
  0: "Nessuna",
  1: "Prioritaria",
  2: "Raccomandata",
  3: "Fax",
  4: "PEC",
  5: "Email",
  6: "SmartMail",
};

export const CODICE_TRIBUTO_F24: EnumMap = {
  0: "Nessuno",
  1019: "1019",
  1020: "1020",
  1038: "1038",
  1040: "1040",
};

export const CAUSALE_PUNTO_18_770: EnumMap = {
  0: "Nessuna",
  1: "Tipo A",
  2: "Tipo M",
  3: "Tipo O",
  4: "Tipo O1",
  5: "Tipo T",
  6: "Tipo W",
  7: "Tipo Z",
};

const PERSONA_ENUM_FIELDS: Readonly<Record<string, EnumMap>> = {
  preferenzaPagamentoRate: PREFERENZA_PAGAMENTO_RATE,
  preferenzaTipoInvioRacc: PREFERENZA_INVIO,
  preferenzaTipoInvioPrior: PREFERENZA_INVIO,
};

const FORNITORE_ENUM_FIELDS: Readonly<Record<string, EnumMap>> = {
  f24CodTributo: CODICE_TRIBUTO_F24,
  causalePunto18770: CAUSALE_PUNTO_18_770,
  preferenzaTipoInvioRacc: PREFERENZA_INVIO,
  preferenzaTipoInvioPrior: PREFERENZA_INVIO,
};

export function etichettaEnum(codice: number, mappa: EnumMap): CodiceEtichetta {
  return { codice, etichetta: mappa[codice] ?? `Sconosciuto (${codice})` };
}

/** Replaces integer enum fields with `{codice, etichetta}`; every other field is passed through. */
function decora(
  record: Record<string, unknown>,
  campi: Readonly<Record<string, EnumMap>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const [campo, mappa] of Object.entries(campi)) {
    const valore = out[campo];
    if (typeof valore === "number") {
      out[campo] = etichettaEnum(valore, mappa);
    }
  }
  return out;
}

export function decoraPersona(record: Record<string, unknown>): Record<string, unknown> {
  return decora(record, PERSONA_ENUM_FIELDS);
}

export function decoraFornitore(record: Record<string, unknown>): Record<string, unknown> {
  return decora(record, FORNITORE_ENUM_FIELDS);
}
