import { store } from "../../store.js";
import {
  autotaskConfigFromEnv,
  normalizeAutotaskZoneUrl,
  sanitizeAutotaskEnvValue,
  type AutotaskConfig,
} from "./config.js";

export type AutotaskConfigSource = "database" | "environment";

export function resolveAutotaskConfig(): {
  config: AutotaskConfig | null;
  source: AutotaskConfigSource | null;
} {
  const stored = store.getAutotaskCredentials();
  if (stored) {
    return { config: stored, source: "database" };
  }

  const fromEnv = autotaskConfigFromEnv();
  if (fromEnv) {
    return { config: fromEnv, source: "environment" };
  }

  return { config: null, source: null };
}

export function autotaskConfig(): AutotaskConfig | null {
  return resolveAutotaskConfig().config;
}

export function saveAutotaskCredentials(input: {
  username: string;
  secret: string;
  integrationCode: string;
  zoneUrl?: string | null;
}): AutotaskConfig {
  const config: AutotaskConfig = {
    username: sanitizeAutotaskEnvValue(input.username),
    secret: sanitizeAutotaskEnvValue(input.secret),
    integrationCode: sanitizeAutotaskEnvValue(input.integrationCode),
    zoneUrl: input.zoneUrl?.trim()
      ? normalizeAutotaskZoneUrl(input.zoneUrl)
      : null,
  };

  if (!config.username || !config.secret || !config.integrationCode) {
    throw new Error("Username, secret, and tracking identifier are required");
  }

  store.setAutotaskCredentials(config);
  return config;
}

export function clearAutotaskCredentials(): void {
  store.clearAutotaskCredentials();
}