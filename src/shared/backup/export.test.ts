import { afterEach, describe, expect, it, vi } from "vitest";
import { saveBackupToDisk, type BackupData } from "./export";

const backup: BackupData = {
  timestamp: "2026-09-25T00:00:00.000Z",
  version: "1.0.0",
  tables: {}
};

describe("saveBackupToDisk", () => {
  afterEach(() => vi.restoreAllMocks());

  it("aborta el stream si falla la escritura", async () => {
    const writeError = new Error("write failed");
    const writable = {
      write: vi.fn().mockRejectedValue(writeError),
      close: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined)
    };
    const directory = {
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue(writable)
      })
    } as unknown as FileSystemDirectoryHandle;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(saveBackupToDisk(backup, directory)).resolves.toBe(false);

    expect(writable.abort).toHaveBeenCalledOnce();
    expect(writable.close).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("Error al guardar backup:", writeError);
  });

  it("conserva el resultado fallido si también falla el abort", async () => {
    const writeError = new Error("write failed");
    const writable = {
      write: vi.fn().mockRejectedValue(writeError),
      close: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockRejectedValue(new Error("abort failed"))
    };
    const directory = {
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue(writable)
      })
    } as unknown as FileSystemDirectoryHandle;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(saveBackupToDisk(backup, directory)).resolves.toBe(false);

    expect(writable.abort).toHaveBeenCalledOnce();
  });
});
