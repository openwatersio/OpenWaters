import { hasStagedFiles } from "@/import/staging";
import { IMPORT_TASK_NAME, runImportTask } from "@/import/state";
import log from "@/logger";
import * as BackgroundTask from "expo-background-task";
import { defineTask } from "expo-task-manager";

const logger = log.extend("import:background");

/**
 * Background task handler. Runs when iOS grants background execution time
 * (~3 minutes). Processes staged files the same way the foreground does.
 */
defineTask(IMPORT_TASK_NAME, async () => {
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
