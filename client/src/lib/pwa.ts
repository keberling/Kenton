export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;

  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.warn("Service worker registration failed", err);
    return null;
  }
}

export function registerLaunchQueueConsumer(onFiles: (files: File[]) => void) {
  if (!window.launchQueue) return () => {};

  window.launchQueue.setConsumer(async (params) => {
    const handles = params.files ?? [];
    if (!handles.length) return;

    const files = await Promise.all(handles.map((handle) => handle.getFile()));
    if (files.length) onFiles(files);
  });

  return () => {};
}

export function isLikelyMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}