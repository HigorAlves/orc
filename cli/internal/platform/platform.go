// Package platform detects the host OS and system package manager, mirroring
// the detection in orc/hooks/scripts/session-start-tool-check.sh so the CLI and
// the SessionStart hook resolve the same install hints from orc/lib/tools.json.
package platform

import (
	"os/exec"
	"runtime"
)

// Platform identifiers. These strings are the keys used in tools.json's
// per-platform install hints and MUST match the bash hook's `platform` values.
const (
	Macos   = "macos"
	Debian  = "debian"
	Fedora  = "fedora"
	Arch    = "arch"
	Linux   = "linux"
	Unknown = "unknown"
)

// PkgManager is a system package manager the CLI can drive for installs.
type PkgManager string

const (
	Brew           PkgManager = "brew"
	Apt            PkgManager = "apt"
	Dnf            PkgManager = "dnf"
	Pacman         PkgManager = "pacman"
	NonePkgManager PkgManager = ""
)

// Detector resolves platform facts. GOOS and Lookup are injectable so the
// detection logic is testable without touching the real host.
type Detector struct {
	GOOS   string
	Lookup func(name string) bool
}

// Detect returns a Detector wired to the running process.
func Detect() Detector {
	return Detector{GOOS: runtime.GOOS, Lookup: binExists}
}

func binExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

// Has reports whether a binary is available on PATH.
func (d Detector) Has(name string) bool {
	if d.Lookup == nil {
		return false
	}
	return d.Lookup(name)
}

// Platform returns the platform identifier (Macos/Debian/Fedora/Arch/Linux/Unknown).
// The Linux branch checks package managers in the same order as the bash hook:
// apt-get, then dnf, then pacman.
func (d Detector) Platform() string {
	switch d.GOOS {
	case "darwin":
		return Macos
	case "linux":
		switch {
		case d.Has("apt-get"):
			return Debian
		case d.Has("dnf"):
			return Fedora
		case d.Has("pacman"):
			return Arch
		default:
			return Linux
		}
	default:
		return Unknown
	}
}

// PackageManager returns the primary system package manager for the host, or
// NonePkgManager when there is no manager the CLI can drive (e.g. macOS without
// Homebrew, or an unrecognized Linux). Tools installed via npm and other
// non-system managers are handled per-tool in the deps layer, not here.
func (d Detector) PackageManager() PkgManager {
	switch d.Platform() {
	case Macos:
		if d.Has("brew") {
			return Brew
		}
		return NonePkgManager
	case Debian:
		return Apt
	case Fedora:
		return Dnf
	case Arch:
		return Pacman
	default:
		return NonePkgManager
	}
}
