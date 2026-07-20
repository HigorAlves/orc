package tui

import (
	"strings"
	"testing"
)

func TestBannerRenders(t *testing.T) {
	b := Banner()
	if !strings.Contains(b, "█") {
		t.Error("banner should contain the block-letter wordmark")
	}
	if !strings.Contains(b, "plugin installer") {
		t.Error("banner should contain the tagline")
	}
	// Print it so `go test -v` shows the mascot.
	t.Logf("\n%s", b)
}

func TestBannerHeightMatchesRender(t *testing.T) {
	if got, want := BannerHeight(), strings.Count(Banner(), "\n")+1; got != want {
		t.Errorf("BannerHeight() = %d; want %d", got, want)
	}
}

func TestMenuViewIncludesBanner(t *testing.T) {
	var m interface{ View() string } = NewMenu()
	if !strings.Contains(m.View(), "█") {
		t.Error("menu View should include the mascot banner")
	}
}
