import { telemetryState } from "@/hooks/useTelemetry";
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://882c6526bba64ca40d6afec59670b82e@o4511294400233472.ingest.us.sentry.io/4511294405148672",

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: false,

  // Enable Logs
  enableLogs: true,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  spotlight: __DEV__,

  // Honor the user's telemetry preference. Defaults to enabled; once the
  // persisted preference hydrates, opted-out users drop all events.
  beforeSend(event) {
    return telemetryState.enabled ? event : null;
  },
});
