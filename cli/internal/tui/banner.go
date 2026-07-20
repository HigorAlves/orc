package tui

import "github.com/charmbracelet/lipgloss"

// The banner is an "ORC" wordmark (ANSI-Shadow figlet) with a pair of tusks
// above it, rendered two-tone: ivory tusks, orc-green lettering, accent tagline.
const orcTusks = `   \\             //`

const orcWordmark = ` ██████╗ ██████╗  ██████╗
██╔═══██╗██╔══██╗██╔════╝
██║   ██║██████╔╝██║
██║   ██║██╔══██╗██║
╚██████╔╝██║  ██║╚██████╗
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝`

var (
	colorTusk = lipgloss.AdaptiveColor{Light: "#57534E", Dark: "#EFE9DC"} // ivory

	tuskStyle = lipgloss.NewStyle().Foreground(colorTusk).Bold(true)

	orcStyle = lipgloss.NewStyle().
			Foreground(colorSuccess). // orc green
			Bold(true)

	taglineStyle = lipgloss.NewStyle().
			Foreground(colorAccent).
			Bold(true).
			Padding(1, 0, 0, 1)
)

// Banner returns the styled ORC wordmark, tusks, and a tagline.
func Banner() string {
	return lipgloss.JoinVertical(
		lipgloss.Left,
		tuskStyle.Render(orcTusks),
		orcStyle.Render(orcWordmark),
		taglineStyle.Render("plugin installer & toolbox"),
	)
}

// BannerHeight is the rendered line count of Banner, used to size the menu list
// beneath it.
func BannerHeight() int {
	return lipgloss.Height(Banner())
}
