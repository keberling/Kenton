import fs from "fs";
import path from "path";
import {
  azureClientId,
  azureClientSecret,
  azureTenantId,
  graphAppAuthEnabled,
} from "../auth/config.js";
import { store } from "../store.js";
import { DEFAULT_SHAREPOINT_FOLDER, normalizeFolderPath } from "./paths.js";

function sharePointDriveId(): string | null {
  return store.getSharePointBackupSettings()?.driveId ?? null;
}

function sharePointFolderPath(): string {
  return store.getSharePointBackupSettings()?.folderPath ?? DEFAULT_SHAREPOINT_FOLDER;
}

export function parseSharePointSiteUrl(input: string): { hostname: string; sitePath: string } {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid SharePoint URL (https://…sharepoint.com/sites/…)");
  }

  if (!url.hostname.includes("sharepoint.com")) {
    throw new Error("URL must be a SharePoint site link");
  }

  const siteMatch = url.pathname.match(/^(\/sites\/[^/]+)/i) ?? url.pathname.match(/^(\/teams\/[^/]+)/i);
  if (!siteMatch) {
    throw new Error("URL must include a site path like /sites/YourSite or /teams/YourTeam");
  }

  return { hostname: url.hostname, sitePath: siteMatch[1] };
}

export async function resolveDriveFromSiteUrl(
  siteUrl: string,
): Promise<{ driveId: string; driveName: string; webUrl: string | null }> {
  const { hostname, sitePath } = parseSharePointSiteUrl(siteUrl);
  const token = await getGraphAppToken();
  const siteRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!siteRes.ok) {
    const text = await siteRes.text();
    throw new Error(`Could not resolve SharePoint site (${siteRes.status}): ${text.slice(0, 240)}`);
  }

  const site = (await siteRes.json()) as { id: string };
  const driveRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${site.id}/drive`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!driveRes.ok) {
    const text = await driveRes.text();
    throw new Error(`Could not resolve document library (${driveRes.status}): ${text.slice(0, 240)}`);
  }

  const drive = (await driveRes.json()) as { id: string; name?: string; webUrl?: string };
  if (!drive.id) throw new Error("SharePoint site has no default document library");

  return {
    driveId: drive.id,
    driveName: drive.name ?? "Documents",
    webUrl: drive.webUrl ?? null,
  };
}

export async function testSharePointFolderAccess(driveId: string, folderPath: string): Promise<void> {
  const token = await getGraphAppToken();
  const segments = normalizeFolderPath(folderPath).split("/").filter(Boolean);
  if (!segments.length) throw new Error("Backup folder path is required");

  let currentPath = "";
  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const encoded = currentPath.split("/").map((part) => encodeURIComponent(part)).join("/");
    const itemRes = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encoded}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (itemRes.ok) continue;

    if (itemRes.status !== 404) {
      const text = await itemRes.text();
      throw new Error(`SharePoint folder check failed (${itemRes.status}): ${text.slice(0, 240)}`);
    }

    const parentEncoded = currentPath.includes("/")
      ? currentPath
          .split("/")
          .slice(0, -1)
          .map((part) => encodeURIComponent(part))
          .join("/")
      : "";
    const childrenUrl = parentEncoded
      ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${parentEncoded}:/children`
      : `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;

    const createRes = await fetch(childrenUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: segment,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`Could not create folder "${segment}" (${createRes.status}): ${text.slice(0, 240)}`);
    }
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getGraphAppToken(): Promise<string> {
  if (!graphAppAuthEnabled()) {
    throw new Error("Graph app auth is not configured (AZURE_CLIENT_SECRET required)");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    client_id: azureClientId(),
    client_secret: azureClientSecret(),
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${azureTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph token request failed (${res.status}): ${text.slice(0, 240)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

function encodeDrivePath(folderPath: string, filename: string): string {
  const combined = `${folderPath.replace(/^\/+|\/+$/g, "")}/${filename}`;
  return combined
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function uploadFileToSharePoint(
  localPath: string,
  filename: string,
): Promise<{ itemId: string; webUrl: string | null }> {
  const driveId = sharePointDriveId();
  if (!driveId) throw new Error("SharePoint backup location is not configured in Settings");

  const token = await getGraphAppToken();
  const size = fs.statSync(localPath).size;
  const folder = sharePointFolderPath();
  const encodedPath = encodeDrivePath(folder, filename);

  if (size <= 4 * 1024 * 1024) {
    const content = fs.readFileSync(localPath);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedPath}:/content`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/gzip",
        },
        body: content,
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SharePoint upload failed (${res.status}): ${text.slice(0, 240)}`);
    }

    const json = (await res.json()) as { id: string; webUrl?: string };
    return { itemId: json.id, webUrl: json.webUrl ?? null };
  }

  const sessionRes = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedPath}:/createUploadSession`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": "replace",
          name: filename,
        },
      }),
    },
  );

  if (!sessionRes.ok) {
    const text = await sessionRes.text();
    throw new Error(`SharePoint upload session failed (${sessionRes.status}): ${text.slice(0, 240)}`);
  }

  const session = (await sessionRes.json()) as { uploadUrl: string };
  const chunkSize = 5 * 1024 * 1024;
  const buffer = fs.readFileSync(localPath);
  let start = 0;

  while (start < size) {
    const end = Math.min(start + chunkSize, size) - 1;
    const chunk = buffer.subarray(start, end + 1);
    const uploadRes = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
      body: chunk,
    });

    if (![200, 201, 202].includes(uploadRes.status)) {
      const text = await uploadRes.text();
      throw new Error(`SharePoint chunk upload failed (${uploadRes.status}): ${text.slice(0, 240)}`);
    }

    if (uploadRes.status === 200 || uploadRes.status === 201) {
      const json = (await uploadRes.json()) as { id: string; webUrl?: string };
      return { itemId: json.id, webUrl: json.webUrl ?? null };
    }

    start = end + 1;
  }

  throw new Error("SharePoint upload session completed without final item response");
}

export async function listSharePointBackups(): Promise<
  Array<{ id: string; name: string; createdAt: number; sizeBytes: number; webUrl: string | null }>
> {
  const driveId = sharePointDriveId();
  if (!driveId) return [];

  const token = await getGraphAppToken();
  const folder = sharePointFolderPath();
  const encodedFolder = folder
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedFolder}:/children?$select=id,name,size,createdDateTime,webUrl`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (res.status === 404) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SharePoint list failed (${res.status}): ${text.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    value?: Array<{
      id: string;
      name: string;
      size?: number;
      createdDateTime?: string;
      webUrl?: string;
    }>;
  };

  return (json.value ?? [])
    .filter((item) => item.name.startsWith("kenton-backup-") && item.name.endsWith(".tar.gz"))
    .map((item) => ({
      id: item.id,
      name: item.name,
      createdAt: item.createdDateTime ? Date.parse(item.createdDateTime) : 0,
      sizeBytes: item.size ?? 0,
      webUrl: item.webUrl ?? null,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSharePointItems(itemIds: string[]) {
  if (!itemIds.length) return;
  const driveId = sharePointDriveId();
  if (!driveId) return;

  const token = await getGraphAppToken();
  for (const itemId of itemIds) {
    await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

export async function downloadSharePointFile(itemId: string, destination: string) {
  const driveId = sharePointDriveId();
  if (!driveId) throw new Error("SharePoint backup location is not configured in Settings");

  const token = await getGraphAppToken();
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`,
    { headers: { Authorization: `Bearer ${token}` }, redirect: "follow" },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SharePoint download failed (${res.status}): ${text.slice(0, 240)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, buffer);
}