import fs from "fs";
import path from "path";
import {
  azureClientId,
  azureClientSecret,
  azureTenantId,
  graphAppAuthEnabled,
} from "../auth/config.js";
import { sharePointDriveId, sharePointFolderPath } from "./config.js";

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
  if (!driveId) throw new Error("SHAREPOINT_DRIVE_ID is not configured");

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
  if (!driveId) throw new Error("SHAREPOINT_DRIVE_ID is not configured");

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