package buildinfo

import "testing"

func TestStringDefaultsToDev(t *testing.T) {
	// With no ldflags injected, callers get a stable, non-empty marker.
	got := String()
	if got == "" {
		t.Fatal("String() returned empty; want a non-empty version marker")
	}
	if got != "dev" {
		t.Fatalf("String() = %q; want %q when version is unset", got, "dev")
	}
}

func TestStringUsesInjectedVersion(t *testing.T) {
	orig := version
	t.Cleanup(func() { version = orig })

	version = "1.2.3"
	if got := String(); got != "1.2.3" {
		t.Fatalf("String() = %q; want %q", got, "1.2.3")
	}
}
