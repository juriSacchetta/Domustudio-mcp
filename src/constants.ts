export const SERVER_NAME = "domustudio-mcp-server";
export const SERVER_VERSION = "0.4.0";

export const DEFAULT_BASE_URL = "https://domustudioapi.danea.it/api/external";
export const API_VERSION = "1.0";

export const DEFAULT_PAGE_SIZE = 50;
/** The API's reported page cap; see docs/adr/0002-pagination-without-a-total.md. */
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGES_PER_CALL = 50;

export const REQUEST_TIMEOUT_MS = 30_000;
export const MAX_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 500;

export const CHARACTER_LIMIT = 50_000;

export const ARCHIVES_ENV_VAR = "DOMUSTUDIO_ARCHIVES";
export const BASE_URL_ENV_VAR = "DOMUSTUDIO_BASE_URL";
export const ENV_FILE_ENV_VAR = "DOMUSTUDIO_ENV_FILE";

export const DEFAULT_ENV_FILE = ".env";
