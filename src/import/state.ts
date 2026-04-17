import { optimizeDatabase } from "@/database";
import {
  importStagedFile,
  type ImportError,
  type ImportFile,
  type ImportRecord,
} from "@/import";
import {
  clearStagingDirectory,
  ensureStagingDirectory,
  extractZipsInStaging,
  hasStagedFiles,
  listStagedFiles,
  stageDirectoryFiles,
  stageFile,
} from "@/import/staging";
import log from "@/logger";
import { File, type Directory } from "expo-file-system";
import { router } from "expo-router";
import { proxy, useSnapshot } from "valtio";

const logger = log.extend("import");

/** Per-import state. `files`, `records`, and `errors` are mutated in place
 *  by the importer. `terminalReason` is set only when the job ended
 *  abnormally. Session-only — not persisted across app launches. */
export type ImportStatus = {
  source: string;
  /** Only set for abnormal terminations. */
  terminalReason?: "error";
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

/** Cancel a running import: stop processing and delete all staged files. */
export function cancelImport(): void {
  cancelled = true;
  clearStagingDirectory();
  importState.status = null;
  processing = false;
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

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

/** Module-level guard to prevent concurrent processing loops. */
let processing = false;
let cancelled = false;

/**
 * The unified import processing loop. Extracts zips, then processes each
 * staged file one by one. Safe to call multiple times — concurrent calls
 * are no-ops.
 *
 * Returns true if all files were processed (staging dir empty), false if
 * processing was interrupted or files remain.
 */
export async function runImportTask(source?: string): Promise<boolean> {
  if (processing) return false;
  processing = true;
  cancelled = false;

  try {
    // Ensure we have a status object for the UI
    if (!importState.status) {
      importState.status = {
        source: source ?? "Import",
        files: [],
        records: [],
        errors: [],
      };
    }
    const summary = importState.status!;

    // Phase 1: extract any zips in staging
    await extractZipsInStaging();

    // Phase 2: list all files to process
    const staged = listStagedFiles();
    if (staged.length === 0) {
      processing = false;
      return true;
    }

    // Seed file entries for UI — skip files already added during staging
    const existingNames = new Set(summary.files.map((f) => f.name));
    for (const f of staged) {
      const name = f.name ?? f.uri.split("/").pop() ?? "file";
      if (!existingNames.has(name)) {
        summary.files.push({ name, status: "pending" });
      }
    }

    // Phase 3: process each file
    for (let i = 0; i < staged.length; i++) {
      if (cancelled) break;
      const name = staged[i].name ?? staged[i].uri.split("/").pop() ?? "file";
      const fileEntry = summary.files.find(
        (f) =>
          f.name === name &&
          (f.status === "pending" || f.status === "importing"),
      );
      await importStagedFile(staged[i], { summary, file: fileEntry });
      if (i % 10 === 9) await yieldToUi();
    }

    // Post-import optimization
    optimizeDatabase().catch(() => {});

    logger.debug(`import complete: ${staged.length} files`);
    return !hasStagedFiles();
  } catch (e) {
    logger.error("import task failed", e);
    if (importState.status) {
      importState.status.terminalReason = "error";
      importState.status.errorMessage =
        e instanceof Error ? e.message : String(e);
    }
    return false;
  } finally {
    processing = false;
  }
}

function fileLabel(file: File): string {
  return file.name ?? file.uri.split("/").pop() ?? "file";
}

export function startFileImport(files: File | File[]): void {
  const list = Array.isArray(files) ? files : [files];
  if (list.length === 0) return;
  if (processing) return;
  const source =
    list.length === 1 ? fileLabel(list[0]) : `${list.length} files`;

  ensureStagingDirectory();
  for (const f of list) {
    stageFile(f);
  }

  void runImportTask(source);
}

export function startDirectoryImport(dir: Directory): void {
  if (processing) return;
  processing = true; // Claim the lock during async staging
  const name = dir.uri.replace(/\/$/, "").split("/").pop() ?? "folder";

  // Show status immediately so the UI reflects progress during staging
  importState.status = {
    source: name,
    files: [],
    records: [],
    errors: [],
  };

  void (async () => {
    try {
      await stageDirectoryFiles(dir, {
        onFile: (staged) => {
          const fileName = staged.name ?? staged.uri.split("/").pop() ?? "file";
          importState.status!.files.push({ name: fileName, status: "pending" });
        },
      });
    } finally {
      processing = false; // Release so runImportTask can acquire it
    }
    await runImportTask(name);
  })();
}

/**
 * Handle a file:// URL from the iOS share sheet or "Open in" action.
 * Stages the file and starts the import, then navigates to the import screen.
 */
export function handleIncomingFileUrl(url: string): void {
  const lower = url.toLowerCase();
  if (!lower.endsWith(".gpx") && !lower.endsWith(".zip")) return;

  const file = new File(url);
  ensureStagingDirectory();
  stageFile(file);

  void runImportTask(fileLabel(file));
  // Defer so the navigator is mounted on cold launch.
  setTimeout(() => router.navigate("/import"), 0);
}

/**
 * Check for staged files on app launch and resume processing if any exist.
 * Called from the root layout on mount.
 */
export function resumeImportIfNeeded(): void {
  if (!hasStagedFiles()) return;
  logger.debug("resuming import from staged files");
  void runImportTask("Resumed import");
}
