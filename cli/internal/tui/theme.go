// Package tui provides the Bubble Tea interactive shell for the orc CLI.
package tui

import "github.com/charmbracelet/lipgloss"

// Palette mirrors the orc callout colors so the TUI reads as part of orc.
// The concrete styles that use these live next to their views (app.go, toggle.go).
var (
	colorAccent  = lipgloss.AdaptiveColor{Light: "#7C3AED", Dark: "#A78BFA"} // orc purple
	colorSuccess = lipgloss.AdaptiveColor{Light: "#15803D", Dark: "#4ADE80"}
	colorWarn    = lipgloss.AdaptiveColor{Light: "#B45309", Dark: "#FBBF24"} //nolint:unused // palette completeness; wired as warn-styled output lands
	colorDanger  = lipgloss.AdaptiveColor{Light: "#B91C1C", Dark: "#F87171"}
	colorMuted   = lipgloss.AdaptiveColor{Light: "#6B7280", Dark: "#9CA3AF"}
)
