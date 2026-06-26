export const DEFAULT_SHAREPOINT_FOLDER = "Kenton/Backups";

export function normalizeFolderPath(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "") || DEFAULT_SHAREPOINT_FOLDER;
}