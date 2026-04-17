import log from "@/logger";
import { Directory, File, Paths } from "expo-file-system";
import { strFromU8, unzipSync } from "fflate";

const logger = log.extend("import:staging");

const STAGING_DIR = "import";

/** Return a filename that doesn't collide with existing files in `dir`. */
function uniqueName(dir: Directory, name: string): string {
  if (!new File(dir, name).exists) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  while (new File(dir, `${base}-${i}${ext}`).exists) i++;
  return `${base}-${i}${ext}`;
}

export function stagingDirectory(): Directory {
  return new Directory(Paths.document, STAGING_DIR);
}

export function ensureStagingDirectory(): Directory {
  const dir = stagingDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

/** Copy a single picked file (.gpx or .zip) into the staging directory. */
export function stageFile(source: File): File {
  const dir = ensureStagingDirectory();
  const dest = new File(dir, uniqueName(dir, source.name ?? "import"));
  source.copy(dest);
  return dest;
}

export type StageDirectoryOptions = {
  /** Called after each file is copied into staging. */
  onFile?: (staged: File) => void;
};

/**
 * Walk a directory recursively for importable files (.gpx, .json, .zip) and
 * copy them into staging. Yields to the UI every 10 files to avoid blocking.
 */
export async function stageDirectoryFiles(
  dir: Directory,
  options?: StageDirectoryOptions,
): Promise<File[]> {
  const staged: File[] = [];
  const stagingDir = ensureStagingDirectory();
  const stack: Directory[] = [dir];
  let count = 0;
  while (stack.length) {
    const current = stack.pop()!;
    let entries: (Directory | File)[];
    try {
      entries = current.list();
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry instanceof Directory) {
        stack.push(entry);
      } else {
        const lower = entry.uri.toLowerCase();
        if (lower.endsWith(".gpx") || lower.endsWith(".json") || lower.endsWith(".zip")) {
          const dest = new File(stagingDir, uniqueName(stagingDir, entry.name ?? "import"));
          entry.copy(dest);
          staged.push(dest);
          options?.onFile?.(dest);
          if (++count % 10 === 0) {
            await new Promise<void>((r) => setTimeout(r, 0));
          }
        }
      }
    }
  }
  return staged;
}

/** List all importable files in the staging directory. */
export function listStagedFiles(): File[] {
  const dir = stagingDirectory();
  if (!dir.exists) return [];
  const files: File[] = [];
  for (const entry of dir.list()) {
    if (entry instanceof File) {
      const lower = entry.name?.toLowerCase() ?? "";
      if (
        lower.endsWith(".gpx") ||
        lower.endsWith(".zip") ||
        lower.endsWith(".json")
      ) {
        files.push(entry);
      }
    }
  }
  return files;
}

/** True if the staging directory contains any importable files. */
export function hasStagedFiles(): boolean {
  return listStagedFiles().length > 0;
}

/** Delete all files from the staging directory. */
export function clearStagingDirectory(): void {
  const dir = stagingDirectory();
  if (!dir.exists) return;
  for (const entry of dir.list()) {
    try {
      if (entry instanceof File) entry.delete();
    } catch {
      // best effort
    }
  }
}

/** Delete a single file from the staging directory after successful import. */
export function deleteStagedFile(file: File): void {
  try {
    file.delete();
  } catch (e) {
    logger.warn("failed to delete staged file", file.uri, e);
  }
}

/**
 * Extract any .zip files in the staging directory in-place: write each
 * .gpx and Navionics .json entry as an individual file into staging,
 * then delete the .zip.
 */
export async function extractZipsInStaging(): Promise<void> {
  const dir = stagingDirectory();
  if (!dir.exists) return;

  for (const entry of dir.list()) {
    if (!(entry instanceof File)) continue;
    if (!entry.name?.toLowerCase().endsWith(".zip")) continue;

    try {
      const bytes = await entry.bytes();
      const entries = unzipSync(bytes);

      for (const [name, data] of Object.entries(entries)) {
        const lower = name.toLowerCase();
        const isGpx = lower.endsWith(".gpx");
        const isJson = lower.endsWith(".json") && name.includes("markers/");
        if (!isGpx && !isJson) continue;

        // Flatten nested paths: "folder/sub/file.gpx" → "folder_sub_file.gpx"
        const flatName = uniqueName(dir, name.replace(/\//g, "_"));
        const dest = new File(dir, flatName);
        dest.write(strFromU8(data));
      }

      entry.delete();
      logger.debug(`extracted zip: ${entry.name}`);
    } catch (e) {
      logger.error(`failed to extract zip: ${entry.name}`, e);
      // Leave the zip in staging for retry
    }
  }
}
