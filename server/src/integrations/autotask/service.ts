import { geocodeAddress } from "../../geocode.js";
import { rescanAllPhotoMatches } from "../../matcher.js";
import { store } from "../../store.js";
import { autotaskConfig, maskAutotaskUsername } from "./config.js";
import {
  formatCompanyAddress,
  getAutotaskCompany,
  queryAutotaskCompanies,
  requireAutotaskConfig,
  testAutotaskConnection,
} from "./client.js";
import type { AutotaskCompanyListItem, AutotaskImportResult } from "./types.js";

export function autotaskEnvDiagnostics() {
  const rawUsername = process.env.AUTOTASK_API_USERNAME ?? "";
  const rawSecret = process.env.AUTOTASK_API_SECRET ?? "";
  const rawCode = process.env.AUTOTASK_INTEGRATION_CODE ?? "";
  const username = rawUsername.trim();
  const secret = rawSecret.trim();
  const integrationCode = rawCode.trim();
  const cleanUsername = username.replace(/^["']|["']$/g, "");
  const cleanSecret = secret.replace(/^["']|["']$/g, "");
  const cleanCode = integrationCode.replace(/^["']|["']$/g, "");

  return {
    hasUsername: Boolean(cleanUsername),
    hasSecret: Boolean(cleanSecret),
    hasIntegrationCode: Boolean(cleanCode),
    usernameLooksLikeEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanUsername),
    integrationCodeLength: cleanCode.length,
    secretLength: cleanSecret.length,
    hadWrappingQuotes:
      (rawSecret !== cleanSecret && (rawSecret.startsWith('"') || rawSecret.startsWith("'"))) ||
      (rawCode !== cleanCode && (rawCode.startsWith('"') || rawCode.startsWith("'"))),
    integrationCodeLooksValid: cleanCode.length >= 8 && !/\s/.test(cleanCode),
  };
}

export function autotaskStatus() {
  const env = autotaskEnvDiagnostics();
  const config = autotaskConfig();
  if (!config) {
    return { configured: false as const, env };
  }

  return {
    configured: true as const,
    username: maskAutotaskUsername(config.username),
    hasZoneOverride: Boolean(config.zoneUrl),
    env,
  };
}

export async function listAutotaskCompaniesForImport(options?: {
  search?: string;
  limit?: number;
}): Promise<AutotaskCompanyListItem[]> {
  const companies = await queryAutotaskCompanies({
    search: options?.search,
    limit: options?.limit,
    customersOnly: true,
  });

  return companies.map((company) => {
    const address = formatCompanyAddress(company);
    const existing = store.findSiteByAutotaskCompanyId(company.id);
    return {
      id: company.id,
      companyName: company.companyName,
      companyType: company.companyType,
      isActive: company.isActive,
      address,
      city: company.city,
      state: company.state,
      postalCode: company.postalCode,
      alreadyImported: Boolean(existing),
      existingSiteId: existing?.id ?? null,
    };
  });
}

export async function importAutotaskCompanies(companyIds: number[]): Promise<AutotaskImportResult> {
  requireAutotaskConfig();

  const uniqueIds = [...new Set(companyIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueIds.length) {
    throw new Error("Select at least one Autotask client to import");
  }

  const result: AutotaskImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    geocoded: 0,
    matchedPhotos: 0,
  };

  for (const companyId of uniqueIds) {
    const company = await getAutotaskCompany(companyId);
    if (!company) {
      result.skipped++;
      continue;
    }

    const address = formatCompanyAddress(company);
    if (!address) {
      result.skipped++;
      continue;
    }

    const geocoded = await geocodeAddress(address);
    const existing = store.findSiteByAutotaskCompanyId(companyId);

    if (existing) {
      store.updateSiteFromAutotask(existing.id, {
        name: company.companyName,
        address,
        lat: geocoded.point?.lat ?? existing.lat,
        lng: geocoded.point?.lng ?? existing.lng,
        geocodeSource: geocoded.point?.source ?? existing.geocodeSource,
      });
      result.updated++;
      if (geocoded.point) result.geocoded++;
      continue;
    }

    store.createSite({
      name: company.companyName,
      address,
      lat: geocoded.point?.lat ?? null,
      lng: geocoded.point?.lng ?? null,
      geocodeSource: geocoded.point?.source ?? "autotask",
      autotaskCompanyId: companyId,
    });
    result.created++;
    if (geocoded.point) result.geocoded++;
  }

  const rescan = rescanAllPhotoMatches({ releaseHeld: false });
  result.matchedPhotos = rescan.matched + rescan.reassigned;

  return result;
}

export { testAutotaskConnection };