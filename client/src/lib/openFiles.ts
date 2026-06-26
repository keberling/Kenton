export function canOpenOriginalFiles(): boolean {
  return typeof window.showOpenFilePicker === "function";
}

export async function pickOriginalImageFiles(): Promise<File[]> {
  const picker = window.showOpenFilePicker;
  if (!picker) return [];

  const handles = await picker({
    multiple: true,
    types: [
      {
        description: "Photos",
        accept: {
          "image/jpeg": [".jpg", ".jpeg"],
          "image/png": [".png"],
          "image/webp": [".webp"],
          "image/heic": [".heic"],
          "image/heif": [".heif"],
          "image/gif": [".gif"],
        },
      },
    ],
  });

  return Promise.all(handles.map((handle: FileSystemFileHandle) => handle.getFile()));
}