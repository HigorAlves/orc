package platform

import "testing"

// have builds a Lookup func that reports the given binaries as present.
func have(bins ...string) func(string) bool {
	set := make(map[string]bool, len(bins))
	for _, b := range bins {
		set[b] = true
	}
	return func(name string) bool { return set[name] }
}

func TestPlatform(t *testing.T) {
	tests := []struct {
		name string
		goos string
		bins []string
		want string
	}{
		{"macos", "darwin", nil, Macos},
		{"debian via apt-get", "linux", []string{"apt-get"}, Debian},
		{"fedora via dnf", "linux", []string{"dnf"}, Fedora},
		{"arch via pacman", "linux", []string{"pacman"}, Arch},
		// apt-get wins when several are present (matches the bash ordering).
		{"debian precedence over dnf", "linux", []string{"apt-get", "dnf"}, Debian},
		{"bare linux", "linux", nil, Linux},
		{"windows is unknown", "windows", nil, Unknown},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := Detector{GOOS: tt.goos, Lookup: have(tt.bins...)}
			if got := d.Platform(); got != tt.want {
				t.Fatalf("Platform() = %q; want %q", got, tt.want)
			}
		})
	}
}

func TestPackageManager(t *testing.T) {
	tests := []struct {
		name string
		goos string
		bins []string
		want PkgManager
	}{
		{"macos with brew", "darwin", []string{"brew"}, Brew},
		{"macos without brew", "darwin", nil, NonePkgManager},
		{"debian", "linux", []string{"apt-get"}, Apt},
		{"fedora", "linux", []string{"dnf"}, Dnf},
		{"arch", "linux", []string{"pacman"}, Pacman},
		{"bare linux", "linux", nil, NonePkgManager},
		{"windows", "windows", nil, NonePkgManager},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := Detector{GOOS: tt.goos, Lookup: have(tt.bins...)}
			if got := d.PackageManager(); got != tt.want {
				t.Fatalf("PackageManager() = %q; want %q", got, tt.want)
			}
		})
	}
}

func TestHasReportsBinaryPresence(t *testing.T) {
	d := Detector{GOOS: "darwin", Lookup: have("npm", "node")}
	if !d.Has("npm") {
		t.Error("Has(npm) = false; want true")
	}
	if d.Has("docker") {
		t.Error("Has(docker) = true; want false")
	}
}

func TestDetectUsesRealEnvironment(t *testing.T) {
	// Detect() must be wired to the running process; the exact values are
	// host-dependent, so we only assert it returns a well-formed detector.
	d := Detect()
	if d.GOOS == "" {
		t.Error("Detect().GOOS is empty")
	}
	if d.Lookup == nil {
		t.Error("Detect().Lookup is nil")
	}
	// Platform() must never panic and must return one of the known values.
	switch d.Platform() {
	case Macos, Debian, Fedora, Arch, Linux, Unknown:
	default:
		t.Errorf("Platform() returned unknown value %q", d.Platform())
	}
}
