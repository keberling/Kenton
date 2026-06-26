const SHARE_DB = "kenton-share-v1";
const SHARE_STORE = "inbox";

interface ShareInboxRecord {
  id: string;
  batchId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  at: number;
}

function openShareDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) {
        db.createObjectStore(SHARE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Share inbox open failed"));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openShareDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(SHARE_STORE, mode);
        const store = tx.objectStore(SHARE_STORE);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Share inbox transaction failed"));
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function drainShareInbox(): Promise<File[]> {
  const records = await withStore("readonly", (store) => store.getAll());
  if (!records.length) return [];

  const files = (records as ShareInboxRecord[]).map(
    (record) =>
      new File([record.blob], record.fileName, {
        type: record.mimeType || record.blob.type || "image/jpeg",
        lastModified: record.at,
      }),
  );

  await withStore("readwrite", (store) => store.clear());
  return files;
}

export function registerShareTargetListener(onFiles: (files: File[]) => void) {
  const handler = (event: MessageEvent) => {
    if (event.data?.type !== "kenton-share") return;
    void drainShareInbox().then((files) => {
      if (files.length) onFiles(files);
    });
  };

  navigator.serviceWorker?.addEventListener("message", handler);
  return () => navigator.serviceWorker?.removeEventListener("message", handler);
}