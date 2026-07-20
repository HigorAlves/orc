package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestLoadMissingFileYieldsEmptyDoc(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	doc, err := Load(path)
	if err != nil {
		t.Fatalf("Load on missing file: %v", err)
	}
	if _, ok := doc.Get("anything"); ok {
		t.Error("empty doc reported a key present")
	}
}

func TestLoadInvalidJSONErrors(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	writeFile(t, path, "{ not valid json ")
	if _, err := Load(path); err == nil {
		t.Fatal("Load accepted invalid JSON; want error so we never clobber it")
	}
}

func TestSavePreservesUnknownKeys(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	writeFile(t, path, `{
  "$schema": "https://example/schema.json",
  "theme": "dark",
  "permissions": {"allow": ["Bash(ls:*)"]}
}`)

	doc, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := doc.Set("enabledPlugins", map[string]bool{"orc@orc": true}); err != nil {
		t.Fatal(err)
	}
	if err := doc.Save(); err != nil {
		t.Fatal(err)
	}

	// Reload from disk and confirm the user's keys survived untouched.
	reloaded, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	var theme string
	if ok, _ := reloaded.Unmarshal("theme", &theme); !ok || theme != "dark" {
		t.Errorf("theme not preserved: ok=%v val=%q", ok, theme)
	}
	var perms struct {
		Allow []string `json:"allow"`
	}
	if ok, _ := reloaded.Unmarshal("permissions", &perms); !ok || len(perms.Allow) != 1 {
		t.Errorf("permissions not preserved: %+v", perms)
	}
	var plugins map[string]bool
	if ok, _ := reloaded.Unmarshal("enabledPlugins", &plugins); !ok || !plugins["orc@orc"] {
		t.Errorf("enabledPlugins not written: %+v", plugins)
	}
}

func TestSaveBacksUpExistingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	writeFile(t, path, `{"theme":"dark"}`)

	doc, _ := Load(path)
	_ = doc.Set("theme", "light")
	if err := doc.Save(); err != nil {
		t.Fatal(err)
	}

	bak, err := os.ReadFile(path + ".bak")
	if err != nil {
		t.Fatalf("expected .bak backup: %v", err)
	}
	if !strings.Contains(string(bak), `"dark"`) {
		t.Errorf(".bak should hold the pre-save content, got: %s", bak)
	}
}

func TestSaveNoBackupForNewFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")

	doc, _ := Load(path)
	_ = doc.Set("theme", "light")
	if err := doc.Save(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path + ".bak"); !os.IsNotExist(err) {
		t.Error("no .bak should be created when the file did not previously exist")
	}
}

func TestSaveLeavesNoTempFiles(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")
	doc, _ := Load(path)
	_ = doc.Set("theme", "light")
	if err := doc.Save(); err != nil {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		name := e.Name()
		if name != "settings.json" {
			t.Errorf("unexpected leftover file after Save: %q", name)
		}
	}
}

func TestSaveCreatesParentDir(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "deep", "settings.json")
	doc, _ := Load(path)
	_ = doc.Set("theme", "light")
	if err := doc.Save(); err != nil {
		t.Fatalf("Save should create missing parent dirs: %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("file not written: %v", err)
	}
}

func TestSaveWritesIndentedJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	doc, _ := Load(path)
	_ = doc.Set("theme", "light")
	_ = doc.Save()
	b, _ := os.ReadFile(path)
	if !strings.Contains(string(b), "\n  ") {
		t.Errorf("expected 2-space indented output, got:\n%s", b)
	}
	// Trailing newline is conventional for config files.
	if !strings.HasSuffix(string(b), "\n") {
		t.Error("expected trailing newline")
	}
}

func TestMergeObjectCreatesAndMerges(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	writeFile(t, path, `{"enabledPlugins":{"other@mkt":true}}`)
	doc, _ := Load(path)

	if err := doc.MergeObject("enabledPlugins", map[string]any{"orc@orc": true}); err != nil {
		t.Fatal(err)
	}
	// Also creates a brand-new object key.
	if err := doc.MergeObject("extraKnownMarketplaces", map[string]any{
		"orc": map[string]any{"source": map[string]any{"source": "github", "repo": "HigorAlves/orc"}},
	}); err != nil {
		t.Fatal(err)
	}
	_ = doc.Save()

	reloaded, _ := Load(path)
	var plugins map[string]bool
	reloaded.Unmarshal("enabledPlugins", &plugins)
	if !plugins["orc@orc"] || !plugins["other@mkt"] {
		t.Errorf("MergeObject dropped a sibling: %+v", plugins)
	}
	var mkt map[string]json.RawMessage
	if ok, _ := reloaded.Unmarshal("extraKnownMarketplaces", &mkt); !ok || len(mkt) != 1 {
		t.Errorf("extraKnownMarketplaces not created: %+v", mkt)
	}
}

func TestMergeObjectRejectsNonObjectKey(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	writeFile(t, path, `{"enabledPlugins":"oops-a-string"}`)
	doc, _ := Load(path)
	if err := doc.MergeObject("enabledPlugins", map[string]any{"orc@orc": true}); err == nil {
		t.Fatal("MergeObject should refuse to merge into a non-object value")
	}
}

func TestDeleteObjectKey(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	writeFile(t, path, `{"enabledPlugins":{"orc@orc":true,"keep@mkt":true}}`)
	doc, _ := Load(path)
	removed, err := doc.DeleteObjectKey("enabledPlugins", "orc@orc")
	if err != nil {
		t.Fatal(err)
	}
	if !removed {
		t.Error("DeleteObjectKey reported no removal for a present key")
	}
	_ = doc.Save()

	reloaded, _ := Load(path)
	var plugins map[string]bool
	reloaded.Unmarshal("enabledPlugins", &plugins)
	if _, gone := plugins["orc@orc"]; gone {
		t.Error("orc@orc not removed")
	}
	if !plugins["keep@mkt"] {
		t.Error("sibling wrongly removed")
	}
}

func TestDefaultPathUnderHome(t *testing.T) {
	t.Setenv("HOME", "/home/tester")
	p, err := DefaultPath()
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join("/home/tester", ".claude", "settings.json")
	if p != want {
		t.Errorf("DefaultPath() = %q; want %q", p, want)
	}
}
