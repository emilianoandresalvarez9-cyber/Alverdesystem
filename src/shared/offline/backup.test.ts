import { describe, expect, it, vi } from "vitest";
import { writePendingOperationsBackup } from "./backup";

describe("respaldo secundario de operaciones pendientes (RF-40)", () => {
  it("cierra el archivo cuando la escritura se guarda", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const abort = vi.fn().mockResolvedValue(undefined);
    const directory = {
      queryPermission: vi.fn().mockResolvedValue("granted" as PermissionState),
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue({ write, close, abort })
      })
    };
    await writePendingOperationsBackup(directory, []);

    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(abort).not.toHaveBeenCalled();
  });

  it("aborta el archivo y conserva el error original si falla la escritura", async () => {
    const error = new Error("write failed");
    const write = vi.fn().mockRejectedValue(error);
    const close = vi.fn().mockResolvedValue(undefined);
    const abort = vi.fn().mockResolvedValue(undefined);
    const directory = {
      queryPermission: vi.fn().mockResolvedValue("granted" as PermissionState),
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue({ write, close, abort })
      })
    };
    await expect(writePendingOperationsBackup(directory, [])).rejects.toBe(error);

    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });
});
