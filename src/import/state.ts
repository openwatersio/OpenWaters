import { Directory, File } from "expo-file-system";
import { router } from "expo-router";
import { proxy, useSnapshot } from "valtio";
import { persistProxy } from "@/persistProxy";
import {
  importPickedDirectory,
  importPickedFile,
  type ImportError,
  type ImportFile,
  type ImportRecord,
} from "@/import";

/** Per-import state. `files`, `records`, and `errors` are mutated in place
 *  by the importer. `terminalReason` is set only when the job ended
 *  abnormally; successful completion is implied by no files in flight. */
export type ImportStatus = {
  source: string;
  /** Only set for abnormal terminations. */
  terminalReason?: "error" | "interrupted";
  /** Populated when `terminalReason === "error"`. */
  errorMessage?: string;
  files: ImportFile[];
  records: ImportRecord[];
  errors: ImportError[];
};

type ImportState = { status: ImportStatus | null };

export const importState = proxy<ImportState>({ status: null });

/** React hook — returns a tracked snapshot of the import state. */
export function useImport() {
  return useSnapshot(importState);
}

export function clearImportStatus(): void {
  importState.status = null;
}

/** True when an import is currently running (any file still in flight). */
export function isImportRunning(
  status: { files: readonly ImportFile[] } | null | undefined,
): boolean {
  if (!status) return false;
  return status.files.some(
    (f) => f.status === "pending" || f.status === "importing",
  );
}

function startJob(source: string): void {
  if (isImportRunning(importState.status)) {
    throw new Error("An import is already running");
  }
  importState.status = {
    source,
    files: [],
    records: [],
    errors: [],
  };
}

async function runJob(
  source: string,
  work: (opts: { summary: ImportStatus }) => Promise<unknown>,
): Promise<void> {
  startJob(source);
  try {
    await work({ summary: importState.status! });
  } catch (e) {
    if (importState.status) {
      importState.status.terminalReason = "error";
      importState.status.errorMessage =
        e instanceof Error ? e.message : String(e);
    }
  }
}

function fileLabel(file: File): string {
  return file.name ?? file.uri.split("/").pop() ?? "file";
}

function seedFile(summary: ImportStatus, name: string): ImportFile {
  summary.files.push({ name, status: "pending" });
  // Return the proxy-wrapped reference from the array — mutations through
  // the pre-push local would bypass valtio's change notifications.
  return summary.files[summary.files.length - 1];
}

export function startFileImport(files: File | File[]): void {
  const list = Array.isArray(files) ? files : [files];
  if (list.length === 0) return;
  const source =
    list.length === 1 ? fileLabel(list[0]) : `${list.length} files`;
  // Fire and forget — screen is driven by the proxy, not the promise.
  void runJob(source, async (opts) => {
    // Seed a file entry per picked file so the UI shows what's coming
    // before any reading/parsing begins.
    const entries = list.map((f) => seedFile(opts.summary, fileLabel(f)));
    for (let i = 0; i < list.length; i++) {
      await importPickedFile(list[i], { ...opts, file: entries[i] });
    }
  });
}

export function startDirectoryImport(dir: Directory): void {
  const name = dir.uri.replace(/\/$/, "").split("/").pop() ?? "folder";
  void runJob(name, async (opts) => {
    // Seed the directory as a single placeholder; importPickedDirectory
    // expands it into per-gpx entries once it lists the directory.
    const entry = seedFile(opts.summary, name);
    await importPickedDirectory(dir, { ...opts, file: entry });
  });
}

/**
 * Handle a file:// URL from the iOS share sheet or "Open in" action.
 * Creates a File from the URI, starts the import, and navigates to the
 * import screen.
 */
export function handleIncomingFileUrl(url: string): void {
  const lower = url.toLowerCase();
  if (!lower.endsWith(".gpx") && !lower.endsWith(".zip")) return;
  const file = new File(url);
  startFileImport(file);
  router.navigate("/import");
}

// Persist the status across app launches. If we find in-flight files/records
// on hydrate, the app was killed mid-import — mark them failed and tag the
// status as interrupted so the UI can surface what landed.
persistProxy(importState, {
  name: "import-status",
  hydrate: (state, persisted) => {
    if (!persisted || !persisted.status) return;
    const { status } = persisted;
    const interrupted = isImportRunning(status);
    state.status = {
      ...status,
      terminalReason: interrupted ? "interrupted" : status.terminalReason,
      files: interrupted
        ? status.files.map((f: ImportFile) =>
            f.status === "pending" || f.status === "importing"
              ? { ...f, status: "failed", error: "Interrupted" }
              : f,
          )
        : status.files,
      records: interrupted
        ? status.records.map((r: ImportRecord) =>
            r.status === "pending" || r.status === "importing"
              ? { ...r, status: "failed", error: "Interrupted" }
              : r,
          )
        : status.records,
    };
  },
});
