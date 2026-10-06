// Next.js calls register() once per server runtime at boot. This is the
// official hook point for loading Sentry's server/edge config — see
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = async (...args: Parameters<NonNullable<typeof import("@sentry/nextjs").captureRequestError>>) => {
  if (!process.env.SENTRY_DSN) return
  const Sentry = await import("@sentry/nextjs")
  Sentry.captureRequestError(...args)
}
