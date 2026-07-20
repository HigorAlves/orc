// Package claudecli is a thin wrapper around the `claude` CLI so the installer
// can drive the official plugin/marketplace/mcp subcommands when they're present.
package claudecli

import (
	"bytes"
	"io"
	"os"
	"os/exec"
)

// lookPath is indirected for tests.
var lookPath = exec.LookPath

// Available reports whether the `claude` binary is on PATH.
func Available() bool {
	_, err := lookPath("claude")
	return err == nil
}

// Run executes `claude <args...>`, streaming stdio to the given writers and
// forwarding the process stdin (so interactive auth prompts still work).
func Run(stdout, stderr io.Writer, args ...string) error {
	cmd := exec.Command("claude", args...)
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	cmd.Stdin = os.Stdin
	return cmd.Run()
}

// Output runs `claude <args...>` and returns its combined stdout+stderr. Used
// for read-only queries like `mcp list`.
func Output(args ...string) (string, error) {
	cmd := exec.Command("claude", args...)
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	err := cmd.Run()
	return buf.String(), err
}
