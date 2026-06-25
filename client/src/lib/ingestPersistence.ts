import type { ClientPhotoMeta } from "./imagePrep";

const DB_NAME = "kenton-ingest-v1";
const STORE = "pending";
const DB_VERSION = 1;

export interface PersistedIngestItem {
  id: string;
  blob: Blob;
  fileName: string;
  originalSize: number;
  uploadSize: number;
  compressed: boolean;
  meta: ClientPhotoMeta;
  retryCount: number;
  sessionId: string | null;
  chunksCompleted: number;
  batchId: string | null;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      }),
  );
}

export async function savePersistedItem(item: PersistedIngestItem) {
  if (!("indexedDB" in globalThis)) return;
  await withStore("readwrite", (store) => store.put(item));
}

export async function deletePersistedItem(id: string) {
  if (!("indexedDB" in globalThis)) return;
  await withStore("readwrite", (store) => store.delete(id));
}

export async function loadPersistedItems(): Promise<PersistedIngestItem[]> {
  if (!("indexedDB" in globalThis)) return [];
  try {
    return await withStore("readonly", (store) => store.getAll());
  } catch {
    return [];
  }
}

export async function clearPersistedItems() {
  if (!("indexedDB" in globalThis)) return;
  await withStore("readwrite", (store) => store.clear());
}