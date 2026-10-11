import { describe, expect, it, vi } from "vitest";

vi.mock("../supabase/client", () => ({ getSupabase: vi.fn() }));

const { isPermanentSyncError } = await import("./sync");

describe("permanent offline sync errors", () => {
  it("does not retry PostgreSQL integrity, permission, or schema errors automatically", () => {
    expect(isPermanentSyncError("23503")).toBe(true);
    expect(isPermanentSyncError("23505")).toBe(true);
    expect(isPermanentSyncError("42501")).toBe(true);
    expect(isPermanentSyncError("42P01")).toBe(true);
    expect(isPermanentSyncError("42703")).toBe(true);
  });

  it("keeps network and transient server errors retryable", () => {
    expect(isPermanentSyncError(undefined)).toBe(false);
    expect(isPermanentSyncError("08006")).toBe(false);
    expect(isPermanentSyncError("57014")).toBe(false);
    expect(isPermanentSyncError("PGRST000")).toBe(false);
  });
});
