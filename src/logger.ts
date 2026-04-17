import { consoleTransport, logger } from "react-native-logs";

const log = logger.createLogger({
  severity: process.env.JEST_WORKER_ID ? "error" : __DEV__ ? "debug" : "info",
  transport: consoleTransport,
  transportOptions: {
    colors: {
      info: "blueBright",
      warn: "yellowBright",
      error: "redBright",
    },
  },
  dateFormat: "iso",
});

log.patchConsole();

export default log;
