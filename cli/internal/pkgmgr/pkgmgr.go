// Package pkgmgr turns a tool's install recipe into a runnable command for the
// host's package manager, and runs it. It prefers the system package manager
// (brew/apt/dnf/pacman), then npm for npm-distributed tools, then uv/pipx for
// Python-distributed tools (e.g. graphify).
package pkgmgr

import (
	"io"
	"os"
	"os/exec"
	"strings"

	"github.com/HigorAlves/orc/cli/internal/deps"
	"github.com/HigorAlves/orc/cli/internal/platform"
)

// Command is a resolved, runnable install command.
type Command struct {
	Name string
	Args []string
}

// String renders the command for display/confirmation.
func (c Command) String() string {
	return strings.TrimSpace(c.Name + " " + strings.Join(c.Args, " "))
}

// Run executes the command, streaming stdio and forwarding stdin (so sudo and
// interactive package managers work).
func (c Command) Run(stdout, stderr io.Writer) error {
	cmd := exec.Command(c.Name, c.Args...)
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	cmd.Stdin = os.Stdin
	return cmd.Run()
}

// verbTokens maps a manager to the command prefix its install invocation uses.
func verbTokens(manager string) []string {
	switch manager {
	case string(platform.Brew):
		return []string{"brew", "install"}
	case string(platform.Apt):
		return []string{"sudo", "apt-get", "install", "-y"}
	case string(platform.Dnf):
		return []string{"sudo", "dnf", "install", "-y"}
	case string(platform.Pacman):
		return []string{"sudo", "pacman", "-S", "--noconfirm"}
	case "npm":
		return []string{"npm", "install", "-g"}
	case "uv":
		return []string{"uv", "tool", "install"}
	case "pipx":
		return []string{"pipx", "install"}
	default:
		return nil
	}
}

func build(manager string, args []string) Command {
	tokens := append(verbTokens(manager), args...)
	return Command{Name: tokens[0], Args: tokens[1:]}
}

// PostInstall returns the tool's optional finish-setup command (argv form, run
// after a successful install), and whether one is defined.
func PostInstall(tool deps.Tool) (Command, bool) {
	if len(tool.PostInstall) == 0 {
		return Command{}, false
	}
	return Command{Name: tool.PostInstall[0], Args: tool.PostInstall[1:]}, true
}

// Resolve picks an install command for tool given the host's system package
// manager and whether npm/uv/pipx are available. It prefers the system manager,
// then npm, then uv, then pipx. Returns ok=false when no unattended recipe
// applies (the caller should then print the tool's install hint instead).
func Resolve(tool deps.Tool, sysMgr platform.PkgManager, hasNpm, hasUv, hasPipx bool) (Command, bool) {
	if sysMgr != platform.NonePkgManager {
		if args, ok := tool.InstallArgs(string(sysMgr)); ok {
			return build(string(sysMgr), args), true
		}
	}
	if hasNpm {
		if args, ok := tool.InstallArgs("npm"); ok {
			return build("npm", args), true
		}
	}
	if hasUv {
		if args, ok := tool.InstallArgs("uv"); ok {
			return build("uv", args), true
		}
	}
	if hasPipx {
		if args, ok := tool.InstallArgs("pipx"); ok {
			return build("pipx", args), true
		}
	}
	return Command{}, false
}
