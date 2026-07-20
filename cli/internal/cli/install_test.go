package cli

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/HigorAlves/orc/cli/internal/plugin"
	"github.com/HigorAlves/orc/cli/internal/settings"
)

func runCmd(t *testing.T, stdin string, args ...string) string {
	t.Helper()
	root := NewRootCmd()
	var out bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&out)
	root.SetIn(strings.NewReader(stdin))
	root.SetArgs(args)
	if err := root.Execute(); err != nil {
		t.Fatalf("command %v failed: %v\noutput:\n%s", args, err, out.String())
	}
	return out.String()
}

func TestInstallSettingsOnlyWritesAndEnables(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	out := runCmd(t, "", "install", "--settings-only", "--ref", "v0.9.0", "--settings", path)
	if !strings.Contains(out, "✅") {
		t.Errorf("expected success marker, got:\n%s", out)
	}

	doc, err := settings.Load(path)
	if err != nil {
		t.Fatal(err)
	}
	st, _ := plugin.Status(doc)
	if !st.Enabled || !st.MarketplaceRegistered || st.Ref != "v0.9.0" {
		t.Errorf("unexpected install state: %+v", st)
	}
}

func TestUninstallSettingsRemovesEntries(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	runCmd(t, "", "install", "--settings-only", "--settings", path)
	// -y skips the confirm prompt; no claude CLI needed for the settings cleanup.
	runCmd(t, "", "uninstall", "-y", "--settings", path)

	doc, _ := settings.Load(path)
	st, _ := plugin.Status(doc)
	if st.Enabled || st.MarketplaceRegistered {
		t.Errorf("entries not removed: %+v", st)
	}
}

func TestUninstallAbortsWithoutConfirmation(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	runCmd(t, "", "install", "--settings-only", "--settings", path)
	// Feed "n" to the prompt.
	out := runCmd(t, "n\n", "uninstall", "--settings", path)
	if !strings.Contains(out, "Aborted") {
		t.Errorf("expected abort, got:\n%s", out)
	}
	doc, _ := settings.Load(path)
	st, _ := plugin.Status(doc)
	if !st.Enabled {
		t.Error("uninstall should not have removed anything after abort")
	}
}

func TestInstallBacksUpExistingSettings(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(path, []byte(`{"theme":"dark"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	runCmd(t, "", "install", "--settings-only", "--settings", path)
	if _, err := os.Stat(path + ".bak"); err != nil {
		t.Errorf("expected backup file: %v", err)
	}
}
