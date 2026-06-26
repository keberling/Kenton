import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Load .env from common locations (does not override existing process.env). */
function loadEnvFiles() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      config({ path });
    }
  }
}

loadEnvFiles();