/// <reference types="vite/client" />

type DirectoryHandle = {
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  getFileHandle(name: string, options: { create: boolean }): Promise<{
    createWritable(): Promise<{
      write(content: string): Promise<void>;
      close(): Promise<void>;
      abort(): Promise<void>;
    }>;
  }>;
};

interface Window {
  showDirectoryPicker?: () => Promise<DirectoryHandle>;
}
