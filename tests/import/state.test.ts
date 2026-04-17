import type { ImportFile } from "@/import";
import { isImportRunning } from "@/import/state";

function file(status: ImportFile["status"]): ImportFile {
  return { name: "test.gpx", status };
}

describe("isImportRunning", () => {
  it("returns false for null", () => {
    expect(isImportRunning(null)).toBe(false);
  });

  it("returns false when there are no files", () => {
    expect(isImportRunning({ files: [] })).toBe(false);
  });

  it("is true when any file is pending", () => {
    expect(isImportRunning({ files: [file("done"), file("pending")] })).toBe(
      true,
    );
  });

  it("is true when any file is importing", () => {
    expect(isImportRunning({ files: [file("done"), file("importing")] })).toBe(
      true,
    );
  });

  it("is false when all files are done", () => {
    expect(isImportRunning({ files: [file("done"), file("done")] })).toBe(
      false,
    );
  });

  it("is false when all files are terminal (done/failed mix)", () => {
    expect(isImportRunning({ files: [file("done"), file("failed")] })).toBe(
      false,
    );
  });
});
