package cli

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestConfigSetGetUnsetRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")

	runCmd(t, "", "config", "set", "pr_size_budget", "450", "--settings", path)
	if got := strings.TrimSpace(runCmd(t, "", "config", "get", "pr_size_budget", "--settings", path)); got != "450" {
		t.Errorf("get after set = %q; want 450", got)
	}

	runCmd(t, "", "config", "unset", "pr_size_budget", "--settings", path)
	if got := strings.TrimSpace(runCmd(t, "", "config", "get", "pr_size_budget", "--settings", path)); got != "(unset)" {
		t.Errorf("get after unset = %q; want (unset)", got)
	}
}

func TestConfigListShowsAllOptions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	out := runCmd(t, "", "config", "--settings", path)
	for _, key := range []string{"pr_size_budget", "protected_branches", "skip_tool_check", "jira_pr_keyword"} {
		if !strings.Contains(out, key) {
			t.Errorf("config list missing %q:\n%s", key, out)
		}
	}
}
