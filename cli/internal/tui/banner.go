package tui

import "github.com/charmbracelet/lipgloss"

// orcArt is an 8-bit-style orc mascot rendered with block-drawing characters.
// Kept narrow (< 40 cols) so it fits comfortably in most terminals.
const orcArt = `      ▄▄▄▄▄▄▄▄▄▄▄
    ▄███████████████▄
   ███ ▀▀▀   ▀▀▀ ███
   ███  ██     ██  ███
   ████▄▄▄▄▄▄▄▄▄▄▄████
   ▜██ ▄█████████▄ ██▛
    ▜█▙▐███████████▌█▛
     ▜█▙▖▝▀▀▀▀▀▀▀▘▗▟█▛
   ▲▲  ▀▘         ▝▀  ▲▲
   ██                 ██`

var (
	orcStyle = lipgloss.NewStyle().
			Foreground(colorSuccess). // orc green
			Bold(true)

	taglineStyle = lipgloss.NewStyle().
			Foreground(colorAccent).
			Bold(true).
			Padding(0, 1)
)

// Banner returns the styled mascot plus a wordmark tagline.
func Banner() string {
	return lipgloss.JoinVertical(
		lipgloss.Left,
		orcStyle.Render(orcArt),
		taglineStyle.Render("orc · plugin installer & toolbox"),
	)
}

// BannerHeight is the rendered line count of Banner, used to size the menu list
// beneath it.
func BannerHeight() int {
	return lipgloss.Height(Banner())
}
