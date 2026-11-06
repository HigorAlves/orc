package cli

import (
	"errors"
	"io"
	"reflect"
	"testing"

	"github.com/spf13/cobra"
)

func TestCodexLifecycle(t *testing.T) {
	old := runCodex
	defer func() { runCodex = old }()
	cases := []struct {
		args []string
		want [][]string
	}{
		{[]string{"install", "--host", "codex", "--ref", "v1"}, [][]string{{"plugin", "marketplace", "add", "https://github.com/HigorAlves/orc.git", "--ref", "v1"}, {"plugin", "add", "orc@orc-codex"}}},
		{[]string{"update", "--host", "codex"}, [][]string{{"plugin", "marketplace", "upgrade", "orc-codex"}, {"plugin", "add", "orc@orc-codex"}}},
		{[]string{"uninstall", "--host", "codex", "--yes"}, [][]string{{"plugin", "remove", "orc@orc-codex"}}},
	}
	for _, tc := range cases {
		var got [][]string
		runCodex = func(_ *cobra.Command, args ...string) error { got = append(got, args); return nil }
		cmd := NewRootCmd()
		cmd.SetOut(io.Discard)
		cmd.SetArgs(tc.args)
		if err := cmd.Execute(); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(got, tc.want) {
			t.Fatalf("got %v, want %v", got, tc.want)
		}
	}
}

func TestCodexInstallStopsOnFailure(t *testing.T) {
	old := runCodex
	defer func() { runCodex = old }()
	calls := 0
	runCodex = func(_ *cobra.Command, _ ...string) error { calls++; return errors.New("offline") }
	cmd := NewRootCmd()
	cmd.SetArgs([]string{"install", "--host", "codex"})
	if cmd.Execute() == nil || calls != 1 {
		t.Fatal("must stop after marketplace failure")
	}
}

func TestInvalidHostDoesNotInstall(t *testing.T) {
	cmd := NewRootCmd()
	cmd.SetArgs([]string{"install", "--host", "unknown"})
	if cmd.Execute() == nil {
		t.Fatal("expected invalid host error")
	}
	cmd = NewRootCmd()
	cmd.SetArgs([]string{"install", "--host", "codex", "--settings-only"})
	if cmd.Execute() == nil {
		t.Fatal("expected Claude-only flag error")
	}
}

func TestCodexStatus(t *testing.T) {
	old := runCodex
	defer func() { runCodex = old }()
	var got []string
	runCodex = func(_ *cobra.Command, args ...string) error { got = args; return nil }
	cmd := NewRootCmd()
	cmd.SetArgs([]string{"status", "--host", "codex"})
	if err := cmd.Execute(); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []string{"plugin", "list"}) {
		t.Fatal(got)
	}
}
