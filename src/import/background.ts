import { hasStagedFiles } from "@/import/staging";
import { runImportTask } from "@/import/state";
import log from "@/logger";
import * as BackgroundTask from "expo-background-task";
import { defineTask } from "expo-task-manager";

const logger = log.extend("import:background");

const TASK_NAME = "import-processing";

/**
 * Background task handler. Runs when iOS grants background execution time
 * (~3 minutes). Processes staged files the same way the foreground does.
 */
defineTask(TASK_NAME, async () => {
  logger.debug("background task started");

  if (!hasStagedFiles()) {
    logger.debug("no staged files, nothing to do");
    return BackgroundTask.BackgroundTaskResult.Success;
  }

  const allDone = await runImportTask("Background import");

  logger.debug(`background task finished, allDone=${allDone}`);
  return allDone
    ? BackgroundTask.BackgroundTaskResult.Success
    : BackgroundTask.BackgroundTaskResult.Failed;
});

/**
 * Register the background processing task with iOS. Safe to call multiple
 * times — skips if already registered. Call at app startup.
 */
export async function registerImportBackgroundTask(): Promise<void> {
  try {
    await BackgroundTask.registerTaskAsync(TASK_NAME, {
      minimumInterval: 15, // minutes — iOS minimum
    });
    logger.debug("background task registered");
  } catch (e) {
    // Expected on simulator or Expo Go
    logger.warn("failed to register background task", e);
  }
}

/**
 * Unregister the background task. Call when all staged files are processed
 * and there's no more work to do.
 */
export async function unregisterImportBackgroundTask(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(TASK_NAME);
  } catch {
    // Task may not be registered
  }
}
