"use client"
import React from "react"

// Keeps a bug inside a game from taking down the whole app: the game area shows a short
// message and the rest of the platform keeps working.
export class GameErrorBoundary extends React.Component<
  { children: React.ReactNode; message: string },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.error("[games] crashed:", err) }
  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-xl border border-[#e3062c]/30 bg-[#e3062c]/10 px-4 py-3 text-[11px] font-bold text-[#ff5f72] leading-relaxed">
          {this.props.message}
        </div>
      )
    }
    return this.props.children
  }
}
