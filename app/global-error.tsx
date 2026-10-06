"use client"
// App Router's hook for reporting an error that crashed the whole app (one
// that even the root layout couldn't survive) to Sentry, then showing a
// plain fallback instead of a blank white screen.
import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", textAlign: "center", padding: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: "#666", marginBottom: 16 }}>The error has been reported. Please reload the page.</p>
          <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", borderRadius: 8, background: "#E30613", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
