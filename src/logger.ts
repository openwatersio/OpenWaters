import { consoleTransport, logger } from "react-native-logs";

const log = logger.createLogger({
  severity: __DEV__ ? "debug" : "info",
  transport: consoleTransport,
  transportOptions: {
    colors: {
      info: "blueBright",
      warn: "yellowBright",
      error: "redBright",
    },
  },
  async: true,
  dateFormat: "iso",
});

log.patchConsole();

export default log;
