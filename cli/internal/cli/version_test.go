package cli

import (
	"bytes"
	"strings"
	"testing"

	"github.com/HigorAlves/orc/cli/internal/buildinfo"
)

func TestVersionCommandPrintsVersion(t *testing.T) {
	root := NewRootCmd()
	var out bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&out)
	root.SetArgs([]string{"version"})

	if err := root.Execute(); err != nil {
		t.Fatalf("version command failed: %v", err)
	}

	got := strings.TrimSpace(out.String())
	if !strings.Contains(got, buildinfo.String()) {
		t.Fatalf("version output %q does not contain %q", got, buildinfo.String())
	}
}
