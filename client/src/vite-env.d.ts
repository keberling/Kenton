/// <reference types="vite/client" />

interface LaunchParams {
  files?: FileSystemFileHandle[];
}

interface Window {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  launchQueue?: {
    setConsumer: (callback: (params: LaunchParams) => void) => void;
  };
}