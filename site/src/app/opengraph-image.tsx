import { ImageResponse } from "next/og"
import { facts } from "@/content/site"

export const alt = "orc · Let the orcs do the work"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const MOSS = "#4f8f2f"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#f4f5ef", color: "#141812" }}>
        <svg width="296" height="112" viewBox="4 5 148 56">
          <g fill="none" stroke={MOSS} strokeWidth="9">
            <circle cx="32" cy="33" r="20" />
            <path d="M72 57.5V33A20 20 0 0 1 92 13" />
            <path d="M139.3 20.1A20 20 0 1 0 139.3 45.9" />
          </g>
          <path fill={MOSS} d="M22 47C22 41 23.5 37 26.5 33C26.5 38 27.5 44 28.5 50Z" />
          <path fill={MOSS} d="M42 47C42 41 40.5 37 37.5 33C37.5 38 36.5 44 35.5 50Z" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>Let the orcs do the work.</div>
          <div style={{ fontSize: 32, color: "#5a6355" }}>The senior-developer workflow as a Claude Code plugin.</div>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 26, color: "#5a6355" }}>
          <span>{facts.skills} skills</span><span>{facts.commands} commands</span><span>{facts.agents} subagents</span><span>MIT · 100% local</span><span>v{facts.version}</span>
        </div>
      </div>
    ),
    size,
  )
}
