import * as Sentry from "@sentry/nextjs";
import { captureConsoleIntegration } from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  integrations: [captureConsoleIntegration({ levels: ["error", "warn"] })],
});
