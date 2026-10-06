// Client-side error monitoring. Next.js auto-loads this file (App Router,
// Next 15.3+) for browser code — no manual import needed anywhere.
// NEXT_PUBLIC_SENTRY_DSN (not SENTRY_DSN) because this runs in the browser
// bundle; only a public DSN belongs there, never a secret.
import * as Sentry from "@sentry/nextjs"

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0, // session replay stays off by default — it's extra data collection a federation app shouldn't turn on silently
  })
}
