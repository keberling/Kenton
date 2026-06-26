const SHARE_DB = "kenton-share-v1";
const SHARE_STORE = "inbox";
const SHARE_TARGET = "/share-target/";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== SHARE_TARGET) return;
  event.respondWith(handleShareTarget(event.request));
});

function openShareDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) {
        db.createObjectStore(SHARE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function storeSharedFiles(entries) {
  const db = await openShareDb();
  const tx = db.transaction(SHARE_STORE, "readwrite");
  const store = tx.objectStore(SHARE_STORE);
  const batchId = `share-${Date.now()}`;
  for (const entry of entries) {
    store.put({
      id: crypto.randomUUID(),
      batchId,
      blob: entry.blob,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      at: Date.now(),
    });
  }
  await txDone(tx);
  db.close();
  return batchId;
}

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const rawFiles = [...formData.getAll("media"), ...formData.getAll("files")];
    const entries = [];

    for (const item of rawFiles) {
      if (!(item instanceof Blob)) continue;
      const fileName =
        item instanceof File && item.name
          ? item.name
          : `shared-${Date.now()}-${entries.length + 1}.jpg`;
      entries.push({
        blob: item,
        fileName,
        mimeType: item.type || "image/jpeg",
      });
    }

    if (entries.length) {
      await storeSharedFiles(entries);
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: "kenton-share", count: entries.length });
      }
    }
  } catch (err) {
    console.error("Share target ingest failed", err);
  }

  return Response.redirect("/?share=1", 303);
}