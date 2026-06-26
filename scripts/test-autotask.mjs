#!/usr/bin/env node
/**
 * Standalone Autotask credential test — run from project root:
 *   node scripts/test-autotask.mjs
 * Requires AUTOTASK_API_USERNAME, AUTOTASK_API_SECRET, AUTOTASK_INTEGRATION_CODE in .env or env.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const p of [resolve(".env"), resolve("..", ".env")]) {
  if (existsSync(p)) config({ path: p });
}

function clean(v) {
  let s = (v ?? "").trim();
  while ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const username = clean(process.env.AUTOTASK_API_USERNAME);
const secret = clean(process.env.AUTOTASK_API_SECRET);
const code = clean(process.env.AUTOTASK_INTEGRATION_CODE);

if (!username || !secret || !code) {
  console.error("Missing AUTOTASK_API_USERNAME, AUTOTASK_API_SECRET, or AUTOTASK_INTEGRATION_CODE");
  process.exit(1);
}

console.log("Username:", username);
console.log("Secret length:", secret.length);
console.log("Integration code length:", code.length);

const zoneRes = await fetch(
  `http://webservices.autotask.net/atservicesrest/v1.0/zoneInformation?user=${encodeURIComponent(username)}`,
);
if (!zoneRes.ok) {
  console.error("Zone lookup failed:", zoneRes.status, await zoneRes.text());
  process.exit(1);
}
const zone = await zoneRes.json();
const base = zone.url.replace(/\/+$/, "");
console.log("Zone:", zone.zoneName, "| Web:", zone.webUrl, "| API:", base);

const authRes = await fetch(`${base}/v1.0/Companies/query`, {
  method: "POST",
  headers: {
    UserName: username,
    Secret: secret,
    ApiIntegrationCode: code,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ filter: [{ op: "exist", field: "id" }], MaxRecords: 1 }),
});

console.log("Auth test status:", authRes.status);
const body = await authRes.text();
if (!authRes.ok) {
  console.error("Body:", body.slice(0, 300));
  console.error("\n401 = wrong password OR wrong tracking identifier for this API user.");
  console.error("Open the API-only user in Autotask → Security tab → copy Custom Internal Integration key.");
  process.exit(1);
}

console.log("OK — Autotask credentials work.");