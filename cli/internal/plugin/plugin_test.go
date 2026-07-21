package plugin

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/HigorAlves/orc/cli/internal/settings"
)

func loadDoc(t *testing.T, content string) (*settings.Doc, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "settings.json")
	if content != "" {
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	doc, err := settings.Load(path)
	if err != nil {
		t.Fatal(err)
	}
	return doc, path
}

func TestInstallWritesMarketplaceAndEnable(t *testing.T) {
	doc, _ := loadDoc(t, "")
	if err := Install(doc, InstallOptions{}); err != nil {
		t.Fatal(err)
	}

	// Marketplace uses the HTTPS clone URL form (avoids the SSH insteadOf
	// rewrite gotcha), with no ref for a latest install.
	var mkt map[string]struct {
		Source struct {
			Source string `json:"source"`
			URL    string `json:"url"`
			Ref    string `json:"ref"`
		} `json:"source"`
	}
	if ok, err := doc.Unmarshal("extraKnownMarketplaces", &mkt); !ok || err != nil {
		t.Fatalf("extraKnownMarketplaces missing: ok=%v err=%v", ok, err)
	}
	entry, ok := mkt[MarketplaceName]
	if !ok {
		t.Fatalf("marketplace %q not written", MarketplaceName)
	}
	if entry.Source.Source != "url" || entry.Source.URL != RepoURL {
		t.Errorf("unexpected source: %+v", entry.Source)
	}
	if entry.Source.Ref != "" {
		t.Errorf("expected no ref for latest install, got %q", entry.Source.Ref)
	}

	var plugins map[string]bool
	doc.Unmarshal("enabledPlugins", &plugins)
	if !plugins[PluginID] {
		t.Errorf("plugin %q not enabled: %+v", PluginID, plugins)
	}
}

func TestInstallWithRefPins(t *testing.T) {
	doc, _ := loadDoc(t, "")
	if err := Install(doc, InstallOptions{Ref: "v0.9.0"}); err != nil {
		t.Fatal(err)
	}
	st, err := Status(doc)
	if err != nil {
		t.Fatal(err)
	}
	if st.Ref != "v0.9.0" {
		t.Errorf("Ref = %q; want v0.9.0", st.Ref)
	}
}

func TestInstallPreservesExistingEntries(t *testing.T) {
	doc, _ := loadDoc(t, `{
  "theme": "dark",
  "extraKnownMarketplaces": {"other": {"source": {"source": "github", "repo": "a/b"}}},
  "enabledPlugins": {"foo@other": true}
}`)
	if err := Install(doc, InstallOptions{}); err != nil {
		t.Fatal(err)
	}
	var mkt map[string]json.RawMessage
	doc.Unmarshal("extraKnownMarketplaces", &mkt)
	if _, ok := mkt["other"]; !ok {
		t.Error("existing marketplace 'other' was dropped")
	}
	if _, ok := mkt[MarketplaceName]; !ok {
		t.Error("orc marketplace not added")
	}
	var plugins map[string]bool
	doc.Unmarshal("enabledPlugins", &plugins)
	if !plugins["foo@other"] || !plugins[PluginID] {
		t.Errorf("plugins not merged correctly: %+v", plugins)
	}
	var theme string
	doc.Unmarshal("theme", &theme)
	if theme != "dark" {
		t.Error("unrelated key not preserved")
	}
}

func TestInstallOverExistingRewritesRef(t *testing.T) {
	doc, _ := loadDoc(t, "")
	_ = Install(doc, InstallOptions{Ref: "v0.8.0"})
	_ = Install(doc, InstallOptions{Ref: "v0.9.0"})
	st, _ := Status(doc)
	if st.Ref != "v0.9.0" {
		t.Errorf("reinstall did not rewrite ref: %q", st.Ref)
	}
}

func TestInstallLatestClearsPriorRef(t *testing.T) {
	doc, _ := loadDoc(t, "")
	_ = Install(doc, InstallOptions{Ref: "v0.9.0"})
	_ = Install(doc, InstallOptions{}) // latest
	st, _ := Status(doc)
	if st.Ref != "" {
		t.Errorf("latest install should clear the pin, got %q", st.Ref)
	}
}

func TestStatusReportsNotInstalled(t *testing.T) {
	doc, _ := loadDoc(t, `{"theme":"dark"}`)
	st, err := Status(doc)
	if err != nil {
		t.Fatal(err)
	}
	if st.MarketplaceRegistered || st.Enabled {
		t.Errorf("expected not-installed state, got %+v", st)
	}
}

func TestUninstallRemovesEntries(t *testing.T) {
	doc, _ := loadDoc(t, "")
	_ = Install(doc, InstallOptions{})
	removed, err := Uninstall(doc)
	if err != nil {
		t.Fatal(err)
	}
	if !removed {
		t.Error("Uninstall reported nothing removed after an install")
	}
	st, _ := Status(doc)
	if st.MarketplaceRegistered || st.Enabled {
		t.Errorf("state after uninstall: %+v", st)
	}
}

func TestUninstallPreservesSiblings(t *testing.T) {
	doc, _ := loadDoc(t, `{
  "extraKnownMarketplaces": {"other": {"source": {"source": "github", "repo": "a/b"}}},
  "enabledPlugins": {"foo@other": true}
}`)
	_ = Install(doc, InstallOptions{})
	_, _ = Uninstall(doc)

	var mkt map[string]json.RawMessage
	doc.Unmarshal("extraKnownMarketplaces", &mkt)
	if _, ok := mkt["other"]; !ok {
		t.Error("uninstall dropped a sibling marketplace")
	}
	var plugins map[string]bool
	doc.Unmarshal("enabledPlugins", &plugins)
	if !plugins["foo@other"] {
		t.Error("uninstall dropped a sibling plugin")
	}
}

func TestUninstallWhenAbsent(t *testing.T) {
	doc, _ := loadDoc(t, `{"theme":"dark"}`)
	removed, err := Uninstall(doc)
	if err != nil {
		t.Fatal(err)
	}
	if removed {
		t.Error("Uninstall reported removal when nothing was installed")
	}
}
