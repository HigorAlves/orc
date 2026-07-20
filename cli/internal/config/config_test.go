package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/HigorAlves/orc/cli/internal/settings"
)

func doc(t *testing.T, content string) *settings.Doc {
	t.Helper()
	path := filepath.Join(t.TempDir(), "settings.json")
	if content != "" {
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	d, err := settings.Load(path)
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func envMap(t *testing.T, d *settings.Doc) map[string]string {
	t.Helper()
	var env map[string]string
	d.Unmarshal("env", &env)
	return env
}

func TestSetIntValidatesAndWritesEnv(t *testing.T) {
	d := doc(t, "")
	if err := Set(d, "pr_size_budget", "500"); err != nil {
		t.Fatal(err)
	}
	if envMap(t, d)["ORC_PR_LOC_BUDGET"] != "500" {
		t.Errorf("env not written: %+v", envMap(t, d))
	}
	if err := Set(d, "pr_size_budget", "notanumber"); err == nil {
		t.Error("expected validation error for non-integer budget")
	}
	if err := Set(d, "pr_size_budget", "0"); err == nil {
		t.Error("expected validation error for non-positive budget")
	}
}

func TestSetStringWritesEnv(t *testing.T) {
	d := doc(t, "")
	if err := Set(d, "protected_branches", "main,release"); err != nil {
		t.Fatal(err)
	}
	if envMap(t, d)["ORC_PROTECTED_BRANCHES"] != "main,release" {
		t.Errorf("env not written: %+v", envMap(t, d))
	}
}

func TestSetBoolTrueWritesOne(t *testing.T) {
	d := doc(t, "")
	if err := Set(d, "skip_tool_check", "true"); err != nil {
		t.Fatal(err)
	}
	if envMap(t, d)["ORC_SKIP_TOOL_CHECK"] != "1" {
		t.Errorf("bool true should write \"1\": %+v", envMap(t, d))
	}
}

func TestSetBoolFalseUnsets(t *testing.T) {
	d := doc(t, `{"env":{"ORC_SKIP_TOOL_CHECK":"1"}}`)
	if err := Set(d, "skip_tool_check", "false"); err != nil {
		t.Fatal(err)
	}
	if _, present := envMap(t, d)["ORC_SKIP_TOOL_CHECK"]; present {
		t.Error("bool false should remove the env var")
	}
}

func TestSetPreservesOtherEnvVars(t *testing.T) {
	d := doc(t, `{"env":{"FOO":"bar"}}`)
	_ = Set(d, "pr_size_budget", "250")
	env := envMap(t, d)
	if env["FOO"] != "bar" {
		t.Error("unrelated env var was dropped")
	}
	if env["ORC_PR_LOC_BUDGET"] != "250" {
		t.Error("new env var not written")
	}
}

func TestUnknownKey(t *testing.T) {
	d := doc(t, "")
	if err := Set(d, "nope", "x"); err == nil {
		t.Error("expected error for unknown config key")
	}
}

func TestGetReturnsCurrentValues(t *testing.T) {
	d := doc(t, `{"env":{"ORC_PR_LOC_BUDGET":"400","ORC_SKIP_TOOL_CHECK":"1"}}`)
	got, err := Get(d)
	if err != nil {
		t.Fatal(err)
	}
	if got["pr_size_budget"] != "400" {
		t.Errorf("pr_size_budget = %q", got["pr_size_budget"])
	}
	if got["skip_tool_check"] != "1" {
		t.Errorf("skip_tool_check = %q", got["skip_tool_check"])
	}
	if _, ok := got["protected_branches"]; ok {
		t.Error("unset option should not appear in Get output")
	}
}

func TestUnsetRemoves(t *testing.T) {
	d := doc(t, `{"env":{"ORC_PR_LOC_BUDGET":"400"}}`)
	removed, err := Unset(d, "pr_size_budget")
	if err != nil {
		t.Fatal(err)
	}
	if !removed {
		t.Error("Unset should report removal")
	}
	if _, present := envMap(t, d)["ORC_PR_LOC_BUDGET"]; present {
		t.Error("env var not removed")
	}
}

func TestOptionsAreDiscoverable(t *testing.T) {
	if len(Options) < 4 {
		t.Errorf("expected the four documented options, got %d", len(Options))
	}
	for _, o := range Options {
		if o.Key == "" || o.Env == "" || o.Desc == "" {
			t.Errorf("incomplete option: %+v", o)
		}
	}
}
