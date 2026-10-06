// Error monitoring for Edge-runtime code (middleware, edge API routes, if any
// are added later). Same guard as sentry.server.config.ts.
import * as Sentry from "@sentry/nextjs"

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  })
}
