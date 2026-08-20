package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fakePlugin lays out <dir>/bin/orc-statusline and returns dir.
func fakePlugin(t *testing.T, root, version string) string {
	t.Helper()
	dir := filepath.Join(root, version)
	if err := os.MkdirAll(filepath.Join(dir, "bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	script := filepath.Join(dir, "bin", "orc-statusline")
	if err := os.WriteFile(script, []byte("#!/bin/sh\necho ok\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	return dir
}

func runStatusline(t *testing.T, args ...string) (string, error) {
	t.Helper()
	root := NewRootCmd()
	var out strings.Builder
	root.SetOut(&out)
	root.SetErr(&out)
	root.SetArgs(args)
	err := root.Execute()
	return out.String(), err
}

func readStatusLine(t *testing.T, path string) (statusLineValue, bool) {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		return statusLineValue{}, false
	}
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("settings not JSON: %v", err)
	}
	v, ok := doc["statusLine"]
	if !ok {
		return statusLineValue{}, false
	}
	var s statusLineValue
	if err := json.Unmarshal(v, &s); err != nil {
		t.Fatalf("statusLine shape: %v", err)
	}
	return s, true
}

func TestStatuslineInstallFresh(t *testing.T) {
	tmp := t.TempDir()
	plugin := fakePlugin(t, tmp, "0.21.0")
	settingsFile := filepath.Join(tmp, "settings.json")
	if err := os.WriteFile(settingsFile, []byte("{}\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	out, err := runStatusline(t, "statusline", "install", "--settings", settingsFile, "--plugin-dir", plugin)
	if err != nil {
		t.Fatalf("install: %v (%s)", err, out)
	}
	s, ok := readStatusLine(t, settingsFile)
	if !ok || s.Type != "command" || !strings.HasSuffix(s.Command, "bin/orc-statusline") {
		t.Fatalf("statusLine not written correctly: %+v ok=%v", s, ok)
	}
}

func TestStatuslineInstallRefusesThirdParty(t *testing.T) {
	tmp := t.TempDir()
	plugin := fakePlugin(t, tmp, "0.21.0")
	settingsFile := filepath.Join(tmp, "settings.json")
	orig := `{"statusLine":{"type":"command","command":"node my-cool-statusline.js"}}`
	if err := os.WriteFile(settingsFile, []byte(orig), 0o644); err != nil {
		t.Fatal(err)
	}

	_, err := runStatusline(t, "statusline", "install", "--settings", settingsFile, "--plugin-dir", plugin)
	if err == nil {
		t.Fatal("install over a third-party statusLine must refuse without --force")
	}
	s, _ := readStatusLine(t, settingsFile)
	if s.Command != "node my-cool-statusline.js" {
		t.Fatalf("third-party statusLine was modified: %+v", s)
	}

	if _, err := runStatusline(t, "statusline", "install", "--force", "--settings", settingsFile, "--plugin-dir", plugin); err != nil {
		t.Fatalf("install --force: %v", err)
	}
	s, _ = readStatusLine(t, settingsFile)
	if !strings.HasSuffix(s.Command, "bin/orc-statusline") {
		t.Fatalf("--force did not replace: %+v", s)
	}
}

func TestStatuslineUninstallOwnershipRules(t *testing.T) {
	tmp := t.TempDir()
	settingsFile := filepath.Join(tmp, "settings.json")

	// third-party value: refused
	if err := os.WriteFile(settingsFile, []byte(`{"statusLine":{"type":"command","command":"node theirs.js"}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := runStatusline(t, "statusline", "uninstall", "--settings", settingsFile); err == nil {
		t.Fatal("uninstall must refuse a statusLine orc does not own")
	}

	// orc-owned value: removed, other keys preserved
	if err := os.WriteFile(settingsFile, []byte(`{"theme":"dark","statusLine":{"type":"command","command":"/x/bin/orc-statusline"}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := runStatusline(t, "statusline", "uninstall", "--settings", settingsFile); err != nil {
		t.Fatalf("uninstall orc-owned: %v", err)
	}
	if _, ok := readStatusLine(t, settingsFile); ok {
		t.Fatal("statusLine not removed")
	}
	raw, _ := os.ReadFile(settingsFile)
	if !strings.Contains(string(raw), "\"theme\"") {
		t.Fatal("unrelated settings keys were not preserved")
	}
}

func TestFindStatuslineScriptPicksNewestVersion(t *testing.T) {
	tmp := t.TempDir()
	cache := filepath.Join(tmp, "plugins", "cache", "orc", "orc")
	fakePlugin(t, cache, "0.9.0")
	fakePlugin(t, cache, "0.21.0")
	fakePlugin(t, cache, "0.10.1")
	t.Setenv("CLAUDE_CONFIG_DIR", tmp)

	got, err := findStatuslineScript("")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got, string(filepath.Separator)+"0.21.0"+string(filepath.Separator)) {
		t.Fatalf("expected newest 0.21.0, got %s", got)
	}
}
