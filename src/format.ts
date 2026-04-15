/**
 * Format elapsed seconds as a timer: "mm:ss" or "h:mm:ss"
 */
export function formatElapsedTime(
  startedAt: number | string | null,
  endedAt?: number | string | null,
): string {
  if (!startedAt) return "00:00";
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return formatElapsedMs(end - new Date(startedAt).getTime());
}

/** Format an elapsed duration (in ms) as "mm:ss" or "h:mm:ss". */
export function formatElapsedMs(ms: number): string {
  if (ms <= 0) return "00:00";
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Format duration as a short summary: "5m" or "2h 15m"
 */
export function formatDuration(
  startedAt: string,
  endedAt: string | null,
): string {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const totalMin = Math.floor((end - new Date(startedAt).getTime()) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Format seconds remaining as an ETA: "<1 min", "5 min", or "2h 15m"
 */
export function formatETA(seconds: number): string {
  if (seconds < 60) return "<1 min";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

/**
 * Format an ISO date string as a localized date: "March 15, 2026"
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format an ISO time string as localized time: "3:45 PM"
 */
export function formatTime(iso: string | null): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Format a byte count as a human-readable string: "512 KB", "1.2 GB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
