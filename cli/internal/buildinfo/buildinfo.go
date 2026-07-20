// Package buildinfo exposes build-time metadata for the orc CLI.
//
// version is overridden at build time via ldflags, e.g.:
//
//	go build -ldflags "-X github.com/HigorAlves/orc/cli/internal/buildinfo.version=1.2.3"
//
// goreleaser sets it from the git tag. When unset (plain `go build`/`go test`),
// it reports "dev".
package buildinfo

// version is injected via -ldflags at release time. Do not rename without
// updating .goreleaser.yaml's ldflags.
var version = "dev"

// String returns the CLI version, or "dev" for unreleased builds.
func String() string {
	if version == "" {
		return "dev"
	}
	return version
}
