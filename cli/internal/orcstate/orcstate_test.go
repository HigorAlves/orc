package orcstate

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInitCreatesStateAndFiles(t *testing.T) {
	root := t.TempDir()
	stateDir := filepath.Join(root, ".orc")

	res, err := Init(stateDir, root, Options{Budget: 500, ExcludeMigrations: true, AdditionalExcludes: []string{"**/vendor/**"}})
	if err != nil {
		t.Fatal(err)
	}
	if !res.CreatedOrcJSON || !res.WrotePRBudget {
		t.Errorf("unexpected result: %+v", res)
	}

	// orc.json has an empty sessions array.
	var oj struct {
		Sessions []any `json:"sessions"`
	}
	readJSON(t, filepath.Join(stateDir, "orc.json"), &oj)
	if oj.Sessions == nil {
		t.Error("orc.json missing sessions array")
	}

	// pr-budget.json holds the personalized config.
	var pb struct {
		Budget             int      `json:"budget"`
		ExcludeMigrations  bool     `json:"exclude_migrations"`
		AdditionalExcludes []string `json:"additional_excludes"`
	}
	readJSON(t, filepath.Join(stateDir, "pr-budget.json"), &pb)
	if pb.Budget != 500 || !pb.ExcludeMigrations || len(pb.AdditionalExcludes) != 1 {
		t.Errorf("pr-budget.json wrong: %+v", pb)
	}
}

func TestInitDefaultsBudget(t *testing.T) {
	root := t.TempDir()
	_, err := Init(filepath.Join(root, ".orc"), root, Options{})
	if err != nil {
		t.Fatal(err)
	}
	var pb struct {
		Budget int `json:"budget"`
	}
	readJSON(t, filepath.Join(root, ".orc", "pr-budget.json"), &pb)
	if pb.Budget != DefaultBudget {
		t.Errorf("budget = %d; want default %d", pb.Budget, DefaultBudget)
	}
}

func TestInitDoesNotClobberExistingOrcJSON(t *testing.T) {
	root := t.TempDir()
	stateDir := filepath.Join(root, ".orc")
	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		t.Fatal(err)
	}
	existing := `{"sessions":[{"branch":"keep"}]}`
	os.WriteFile(filepath.Join(stateDir, "orc.json"), []byte(existing), 0o644)

	res, err := Init(stateDir, root, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if res.CreatedOrcJSON {
		t.Error("should not report creating orc.json when it already existed")
	}
	b, _ := os.ReadFile(filepath.Join(stateDir, "orc.json"))
	if !strings.Contains(string(b), "keep") {
		t.Error("existing sessions were clobbered")
	}
}

func TestInitAddsGitignoreEntry(t *testing.T) {
	root := t.TempDir()
	_, err := Init(filepath.Join(root, ".orc"), root, Options{})
	if err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(filepath.Join(root, ".gitignore"))
	if err != nil {
		t.Fatalf("gitignore not created: %v", err)
	}
	if !strings.Contains(string(b), ".orc/") {
		t.Errorf(".gitignore missing .orc/ entry:\n%s", b)
	}
}

func TestInitGitignoreNotDuplicated(t *testing.T) {
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, ".gitignore"), []byte("node_modules\n.orc/\n"), 0o644)
	res, err := Init(filepath.Join(root, ".orc"), root, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if res.GitignoreUpdated {
		t.Error("should not update .gitignore when .orc/ is already ignored")
	}
	b, _ := os.ReadFile(filepath.Join(root, ".gitignore"))
	if strings.Count(string(b), ".orc/") != 1 {
		t.Errorf("duplicate .orc/ entry:\n%s", b)
	}
}

func readJSON(t *testing.T, path string, dst any) {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	if err := json.Unmarshal(b, dst); err != nil {
		t.Fatalf("parse %s: %v", path, err)
	}
}
