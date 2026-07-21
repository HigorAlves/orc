package claudecli

import (
	"errors"
	"testing"
)

func TestAvailable(t *testing.T) {
	orig := lookPath
	t.Cleanup(func() { lookPath = orig })

	lookPath = func(string) (string, error) { return "/usr/local/bin/claude", nil }
	if !Available() {
		t.Error("Available() = false when claude is on PATH")
	}

	lookPath = func(string) (string, error) { return "", errors.New("not found") }
	if Available() {
		t.Error("Available() = true when claude is absent")
	}
}
