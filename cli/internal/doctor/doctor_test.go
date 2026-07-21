package doctor

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/HigorAlves/orc/cli/internal/deps"
)

func sampleReport() deps.Report {
	return deps.Report{
		Required: []deps.Status{
			{Tool: deps.Tool{Name: "git", Tier: deps.TierRequired}, Present: true},
			{Tool: deps.Tool{Name: "jq", Tier: deps.TierRequired, Hints: map[string]string{"macos": "brew install jq", "default": "see docs"}}, Present: false},
		},
		Recommended: []deps.Status{
			{Tool: deps.Tool{Name: "gh", Tier: deps.TierRecommended, UsedBy: "`/orc:ship`", Hints: map[string]string{"macos": "brew install gh", "default": "see docs"}}, Present: false},
		},
	}
}

func TestRenderListsMissingWithHints(t *testing.T) {
	out := Render(sampleReport(), "macos")
	for _, want := range []string{"jq", "brew install jq", "gh", "brew install gh", "/orc:ship"} {
		if !strings.Contains(out, want) {
			t.Errorf("Render output missing %q\n---\n%s", want, out)
		}
	}
	// A present required tool need not be nagged about with a hint line.
	if strings.Contains(out, "brew install git") {
		t.Error("Render should not print an install hint for a present tool")
	}
}

func TestRenderUsesPlatformHint(t *testing.T) {
	out := Render(sampleReport(), "arch")
	if !strings.Contains(out, "see docs") {
		t.Errorf("Render should fall back to default hint on arch:\n%s", out)
	}
}

func TestRenderAllPresent(t *testing.T) {
	rep := deps.Report{
		Required: []deps.Status{{Tool: deps.Tool{Name: "git"}, Present: true}},
	}
	out := Render(rep, "macos")
	if !strings.Contains(out, "✅") {
		t.Errorf("all-present render should show a success marker, got:\n%s", out)
	}
}

func TestRenderJSONShape(t *testing.T) {
	b, err := RenderJSON(sampleReport(), "macos")
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		OK       bool `json:"ok"`
		Required []struct {
			Name    string `json:"name"`
			Present bool   `json:"present"`
			Hint    string `json:"hint,omitempty"`
		} `json:"required"`
		Recommended []struct {
			Name string `json:"name"`
		} `json:"recommended"`
	}
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("RenderJSON produced invalid JSON: %v", err)
	}
	if got.OK {
		t.Error("ok should be false when a required tool is missing")
	}
	if len(got.Required) != 2 || len(got.Recommended) != 1 {
		t.Errorf("unexpected counts: required=%d recommended=%d", len(got.Required), len(got.Recommended))
	}
}
