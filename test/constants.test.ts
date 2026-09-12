import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SERVER_NAME, SERVER_VERSION } from "../src/constants.js";

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pacchetto = JSON.parse(readFileSync(resolve(RADICE, "package.json"), "utf8")) as {
  name: string;
  version: string;
};

describe("identità annunciata dal server", () => {
  it("annuncia la versione del package", () => {
    expect(SERVER_VERSION).toBe(pacchetto.version);
  });

  it("annuncia il nome del package", () => {
    expect(SERVER_NAME).toBe(pacchetto.name);
  });
});
