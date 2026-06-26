import { graphAppAuthEnabled } from "../auth/config.js";
import { store } from "../store.js";
import { DEFAULT_SHAREPOINT_FOLDER, normalizeFolderPath } from "./paths.js";
import { resolveDriveFromSiteUrl, testSharePointFolderAccess } from "./sharepoint.js";

export { normalizeFolderPath } from "./paths.js";

export interface SharePointBackupSettings {
  siteUrl: string;
  folderPath: string;
  driveId: string;
  driveName: string | null;
  resolvedAt: number;
}

export interface SharePointBackupSettingsPublic {
  configured: boolean;
  graphAuthReady: boolean;
  siteUrl: string | null;
  folderPath: string;
  driveName: string | null;
  updatedAt: number | null;
}

export function getSharePointSettings(): SharePointBackupSettings | null {
  return store.getSharePointBackupSettings();
}

export function sharePointDriveId(): string | null {
  return getSharePointSettings()?.driveId ?? null;
}

export function sharePointFolderPath(): string {
  return getSharePointSettings()?.folderPath ?? DEFAULT_SHAREPOINT_FOLDER;
}

export function sharePointSiteUrl(): string | null {
  return getSharePointSettings()?.siteUrl ?? null;
}

export function sharePointSettingsPublic(): SharePointBackupSettingsPublic {
  const settings = getSharePointSettings();
  return {
    configured: Boolean(settings?.driveId),
    graphAuthReady: graphAppAuthEnabled(),
    siteUrl: settings?.siteUrl ?? null,
    folderPath: settings?.folderPath ?? DEFAULT_SHAREPOINT_FOLDER,
    driveName: settings?.driveName ?? null,
    updatedAt: settings?.resolvedAt ?? null,
  };
}

export async function saveSharePointSettings(input: {
  siteUrl: string;
  folderPath: string;
}): Promise<SharePointBackupSettings> {
  const siteUrl = input.siteUrl.trim();
  const folderPath = normalizeFolderPath(input.folderPath);

  if (!siteUrl) {
    throw new Error("SharePoint site URL is required");
  }

  if (!graphAppAuthEnabled()) {
    throw new Error("AZURE_CLIENT_SECRET must be set in server environment before configuring SharePoint");
  }

  const resolved = await resolveDriveFromSiteUrl(siteUrl);
  const settings: SharePointBackupSettings = {
    siteUrl,
    folderPath,
    driveId: resolved.driveId,
    driveName: resolved.driveName,
    resolvedAt: Date.now(),
  };

  store.setSharePointBackupSettings(settings);
  return settings;
}

export async function testSharePointSettings(): Promise<{ ok: boolean; message: string }> {
  const settings = getSharePointSettings();
  if (!settings?.driveId) {
    return { ok: false, message: "SharePoint backup location is not configured" };
  }

  if (!graphAppAuthEnabled()) {
    return { ok: false, message: "AZURE_CLIENT_SECRET is not configured on the server" };
  }

  try {
    await testSharePointFolderAccess(settings.driveId, settings.folderPath);
    const library = settings.driveName ? ` (${settings.driveName})` : "";
    return {
      ok: true,
      message: `Connected to ${settings.siteUrl}${library} — folder "${settings.folderPath}" is reachable`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "SharePoint connection test failed",
    };
  }
}