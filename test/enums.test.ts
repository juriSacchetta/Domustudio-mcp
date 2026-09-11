import { describe, expect, it } from "vitest";
import {
  CAUSALE_PUNTO_18_770,
  CODICE_TRIBUTO_F24,
  FILTRO_SUBENTRI,
  PREFERENZA_INVIO,
  PREFERENZA_PAGAMENTO_RATE,
  decoraFornitore,
  decoraPersona,
  etichettaEnum,
} from "../src/domustudio/enums.js";

describe("etichettaEnum", () => {
  it("copre ogni codice dichiarato nello spec OpenAPI", () => {
    expect(Object.keys(FILTRO_SUBENTRI).map(Number)).toEqual([1, 2, 3, 4, 5]);
    expect(Object.keys(PREFERENZA_PAGAMENTO_RATE).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(Object.keys(PREFERENZA_INVIO).map(Number)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(Object.keys(CODICE_TRIBUTO_F24).map(Number)).toEqual([0, 1019, 1020, 1038, 1040]);
    expect(Object.keys(CAUSALE_PUNTO_18_770).map(Number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("etichetta un codice noto", () => {
    expect(etichettaEnum(2, FILTRO_SUBENTRI)).toEqual({ codice: 2, etichetta: "Attivi" });
    expect(etichettaEnum(4, PREFERENZA_INVIO)).toEqual({ codice: 4, etichetta: "PEC" });
  });

  it("non perde un codice sconosciuto introdotto dall'API", () => {
    expect(etichettaEnum(99, FILTRO_SUBENTRI)).toEqual({
      codice: 99,
      etichetta: "Sconosciuto (99)",
    });
  });
});

describe("decoraPersona / decoraFornitore", () => {
  it("sostituisce solo i campi enumerativi della persona", () => {
    const decorato = decoraPersona({
      descr: "Rossi Mario",
      preferenzaPagamentoRate: 4,
      preferenzaTipoInvioRacc: 2,
      preferenzaTipoInvioPrior: 5,
      tel1: "0123",
    });
    expect(decorato["preferenzaPagamentoRate"]).toEqual({ codice: 4, etichetta: "MAV" });
    expect(decorato["preferenzaTipoInvioRacc"]).toEqual({ codice: 2, etichetta: "Raccomandata" });
    expect(decorato["preferenzaTipoInvioPrior"]).toEqual({ codice: 5, etichetta: "Email" });
    expect(decorato["descr"]).toBe("Rossi Mario");
    expect(decorato["tel1"]).toBe("0123");
  });

  it("sostituisce i campi enumerativi del fornitore", () => {
    const decorato = decoraFornitore({
      descr: "Idraulica SRL",
      f24CodTributo: 1020,
      causalePunto18770: 3,
      fornitoreInattivo: false,
    });
    expect(decorato["f24CodTributo"]).toEqual({ codice: 1020, etichetta: "1020" });
    expect(decorato["causalePunto18770"]).toEqual({ codice: 3, etichetta: "Tipo O" });
    expect(decorato["fornitoreInattivo"]).toBe(false);
  });

  it("lascia intatti i campi assenti o non numerici", () => {
    const decorato = decoraPersona({ descr: "X", preferenzaPagamentoRate: null });
    expect(decorato["preferenzaPagamentoRate"]).toBeNull();
    expect(decoraPersona({ descr: "X" })["preferenzaPagamentoRate"]).toBeUndefined();
  });

  it("non muta il record originale", () => {
    const originale = { preferenzaPagamentoRate: 1 };
    decoraPersona(originale);
    expect(originale.preferenzaPagamentoRate).toBe(1);
  });
});
