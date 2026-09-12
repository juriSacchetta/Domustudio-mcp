import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";

export interface CartellaTemporanea {
  /** Valid inside a test; each one gets a fresh directory. */
  readonly percorso: string;
  scrivi(nome: string, contenuto: string): string;
}

/** Registers a temporary directory, created before each test and removed after it. */
export function cartellaTemporanea(prefisso: string): CartellaTemporanea {
  let percorso = "";

  beforeEach(() => {
    percorso = mkdtempSync(join(tmpdir(), prefisso));
  });

  afterEach(() => {
    rmSync(percorso, { recursive: true, force: true });
  });

  return {
    get percorso() {
      return percorso;
    },
    scrivi(nome, contenuto) {
      const file = join(percorso, nome);
      writeFileSync(file, contenuto);
      return file;
    },
  };
}
