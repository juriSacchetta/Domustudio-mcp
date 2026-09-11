import { describe, expect, it } from "vitest";
import {
  condominioMarkdown,
  fornitoreMarkdown,
  personaMarkdown,
  troncaTesto,
} from "../src/format.js";

describe("condominioMarkdown", () => {
  it("mostra intestazione, id, indirizzo, codice fiscale e amministratore", () => {
    const md = condominioMarkdown({
      id: 12,
      intestazione: "Condominio Via Roma 5",
      indirizzo: "Via Roma 5",
      cap: "31100",
      citta: "Treviso",
      prov: "TV",
      codFisc: "94000000000",
      amministratore: { nome: "Studio DeSa", email: "info@example.test" },
    });
    expect(md).toContain("## Condominio Via Roma 5 — id 12");
    expect(md).toContain("- **Indirizzo:** Via Roma 5, 31100 Treviso, (TV)");
    expect(md).toContain("- **Codice fiscale:** 94000000000");
    expect(md).toContain("- **Amministratore:** Studio DeSa");
  });

  it("regge un record quasi vuoto senza righe fantasma", () => {
    const md = condominioMarkdown({ id: 3 });
    expect(md).toBe("## (senza intestazione) — id 3");
  });
});

describe("personaMarkdown", () => {
  it("unisce liste di email e più telefoni, e mostra l'etichetta di un enum", () => {
    const md = personaMarkdown({
      descr: "Rossi Mario",
      codFisc: "RSSMRA80A01L407X",
      email: ["a@example.test", "b@example.test"],
      tel1: "0422 1",
      tel2: "",
      tel3: "347 2",
      preferenzaPagamentoRate: { codice: 4, etichetta: "MAV" },
    });
    expect(md).toContain("## Rossi Mario");
    expect(md).toContain("- **Email:** a@example.test, b@example.test");
    expect(md).toContain("- **Telefono:** 0422 1, 347 2");
    expect(md).toContain("- **Preferenza pagamento rate:** MAV");
  });

  it("omette i campi nulli, vuoti e le liste vuote", () => {
    const md = personaMarkdown({ descr: "Solo Nome", codFisc: null, email: [], note: "" });
    expect(md).toBe("## Solo Nome");
  });
});

describe("fornitoreMarkdown", () => {
  it("segnala un fornitore inattivo nel titolo", () => {
    const md = fornitoreMarkdown({ descr: "Idraulica SRL", fornitoreInattivo: true });
    expect(md).toContain("## Idraulica SRL — INATTIVO");
  });

  it("mostra attività, IBAN e stato DURC", () => {
    const md = fornitoreMarkdown({
      descr: "Idraulica SRL",
      fornitoreAttivita: "Idraulico",
      iban: "IT60X0542811101000000123456",
      descStatoDurc: "Regolare",
      fornitoreInattivo: false,
    });
    expect(md).toContain("- **Attività:** Idraulico");
    expect(md).toContain("- **IBAN:** IT60X0542811101000000123456");
    expect(md).toContain("- **Stato DURC:** Regolare");
    expect(md).not.toContain("INATTIVO");
  });
});

describe("troncaTesto", () => {
  it("lascia intatto un testo sotto il limite", () => {
    expect(troncaTesto("breve", 100)).toBe("breve");
  });

  it("taglia su un confine di riga e aggiunge l'avviso", () => {
    const lungo = Array.from({ length: 200 }, (_, i) => `riga ${i}`).join("\n");
    const troncato = troncaTesto(lungo, 300);
    expect(troncato.length).toBeLessThanOrEqual(300);
    expect(troncato).toContain("Output troncato a 300 caratteri");
    expect(troncato.split("\n").at(-1)).toContain("[Output troncato");
  });
});
