package cli

import (
	"bufio"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

// confirm asks a yes/no question on the command's input stream, defaulting to
// no. It is bypassed by callers that pass --yes.
func confirm(cmd *cobra.Command, question string) bool {
	fmt.Fprintf(cmd.OutOrStdout(), "%s [y/N] ", question)
	r := bufio.NewReader(cmd.InOrStdin())
	line, err := r.ReadString('\n')
	if err != nil && line == "" {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(line)) {
	case "y", "yes":
		return true
	default:
		return false
	}
}
