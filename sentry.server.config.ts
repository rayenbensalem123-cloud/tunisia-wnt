// Server-side error monitoring. Loaded by instrumentation.ts for the Node
// runtime. Guarded on SENTRY_DSN being set so a deploy without it behaves
// exactly as before — no crash, just no reporting (same pattern as the Zoom
// integration: missing config degrades gracefully, never breaks the build
// or the app).
import * as Sentry from "@sentry/nextjs"

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Keep volume low on a free Sentry plan; raise this once there's a reason to.
  })
}
