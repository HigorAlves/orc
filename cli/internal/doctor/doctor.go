// Package doctor renders a deps.Report for humans (text) and machines (JSON).
package doctor

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/HigorAlves/orc/cli/internal/deps"
)

// Render produces a human-readable summary of the tool check. The palette
// mirrors the SessionStart hook (🛑 required, ⚠️ recommended) without GitHub
// [!TYPE] tags, which render as junk in a terminal.
func Render(rep deps.Report, platform string) string {
	missReq := rep.MissingRequired()
	missRec := rep.MissingRecommended()

	if len(missReq) == 0 && len(missRec) == 0 {
		return "✅ All orc tools are installed."
	}

	var b strings.Builder
	if len(missReq) > 0 {
		b.WriteString("🛑 Missing required (orc hooks/commands break without these):\n")
		for _, s := range missReq {
			fmt.Fprintf(&b, "  • %s — %s\n", s.Tool.Name, s.Tool.Hint(platform))
		}
	}
	if len(missRec) > 0 {
		if len(missReq) > 0 {
			b.WriteString("\n")
		}
		b.WriteString("⚠️  Missing recommended (some commands won't work):\n")
		for _, s := range missRec {
			fmt.Fprintf(&b, "  • %s — %s\n", s.Tool.Name, s.Tool.Hint(platform))
			if s.Tool.UsedBy != "" {
				fmt.Fprintf(&b, "      used by: %s\n", s.Tool.UsedBy)
			}
		}
	}
	return strings.TrimRight(b.String(), "\n")
}

type jsonStatus struct {
	Name    string `json:"name"`
	Tier    string `json:"tier"`
	Present bool   `json:"present"`
	Hint    string `json:"hint,omitempty"`
	UsedBy  string `json:"usedBy,omitempty"`
}

type jsonReport struct {
	OK          bool         `json:"ok"`
	Platform    string       `json:"platform"`
	Required    []jsonStatus `json:"required"`
	Recommended []jsonStatus `json:"recommended"`
}

func toJSONStatuses(in []deps.Status, platform string) []jsonStatus {
	out := make([]jsonStatus, 0, len(in))
	for _, s := range in {
		js := jsonStatus{
			Name:    s.Tool.Name,
			Tier:    string(s.Tool.Tier),
			Present: s.Present,
			UsedBy:  s.Tool.UsedBy,
		}
		if !s.Present {
			js.Hint = s.Tool.Hint(platform)
		}
		out = append(out, js)
	}
	return out
}

// RenderJSON produces a machine-readable report for scripts and CI.
func RenderJSON(rep deps.Report, platform string) ([]byte, error) {
	jr := jsonReport{
		OK:          rep.OK(),
		Platform:    platform,
		Required:    toJSONStatuses(rep.Required, platform),
		Recommended: toJSONStatuses(rep.Recommended, platform),
	}
	return json.MarshalIndent(jr, "", "  ")
}
