// Command orc is the installer/doctor/config CLI for the orc Claude Code plugin.
package main

import (
	"fmt"
	"os"

	"github.com/HigorAlves/orc/cli/internal/cli"
)

func main() {
	if err := cli.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, "orc:", err)
		os.Exit(1)
	}
}
