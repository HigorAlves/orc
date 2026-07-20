// Package settings reads and writes Claude Code's ~/.claude/settings.json
// safely. The core guarantees:
//
//   - Unknown keys are preserved verbatim (values are kept as raw JSON and only
//     the keys orc manages are ever touched).
//   - Invalid JSON is never clobbered — Load fails loudly instead.
//   - Writes are atomic (temp file + rename) and the prior file is backed up to
//     <path>.bak.
//
// Top-level keys are re-serialized in sorted order on Save. This is lossless
// (all data is preserved) but does not retain the original key ordering.
package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Doc is an in-memory view of a settings.json file.
type Doc struct {
	path string
	raw  map[string]json.RawMessage
}

// DefaultPath returns $HOME/.claude/settings.json.
func DefaultPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home directory: %w", err)
	}
	return filepath.Join(home, ".claude", "settings.json"), nil
}

// Load reads the settings file at path. A missing file yields an empty Doc
// (not an error). Malformed JSON is an error so the caller never overwrites a
// file it could not parse.
func Load(path string) (*Doc, error) {
	d := &Doc{path: path, raw: map[string]json.RawMessage{}}

	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return d, nil
		}
		return nil, fmt.Errorf("read %s: %w", path, err)
	}

	// An empty (or whitespace-only) file is treated as an empty object.
	if len(trimSpace(b)) == 0 {
		return d, nil
	}
	if err := json.Unmarshal(b, &d.raw); err != nil {
		return nil, fmt.Errorf("parse %s (refusing to overwrite unparseable settings): %w", path, err)
	}
	if d.raw == nil {
		d.raw = map[string]json.RawMessage{}
	}
	return d, nil
}

func trimSpace(b []byte) []byte {
	i, j := 0, len(b)
	for i < j && isSpace(b[i]) {
		i++
	}
	for j > i && isSpace(b[j-1]) {
		j--
	}
	return b[i:j]
}

func isSpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r'
}

// Path returns the file path this Doc is bound to.
func (d *Doc) Path() string { return d.path }

// Get returns the raw JSON for a top-level key.
func (d *Doc) Get(key string) (json.RawMessage, bool) {
	v, ok := d.raw[key]
	return v, ok
}

// Set marshals value and stores it under key.
func (d *Doc) Set(key string, value any) error {
	b, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal value for %q: %w", key, err)
	}
	d.raw[key] = b
	return nil
}

// Delete removes a top-level key. Returns whether it was present.
func (d *Doc) Delete(key string) bool {
	_, ok := d.raw[key]
	delete(d.raw, key)
	return ok
}

// Unmarshal decodes a top-level key into dst. Returns whether the key existed.
func (d *Doc) Unmarshal(key string, dst any) (bool, error) {
	v, ok := d.raw[key]
	if !ok {
		return false, nil
	}
	if err := json.Unmarshal(v, dst); err != nil {
		return true, fmt.Errorf("unmarshal %q: %w", key, err)
	}
	return true, nil
}

// MergeObject merges entries into the JSON object stored at key, creating the
// object when the key is absent. It errors if the existing value is present but
// is not a JSON object, rather than silently overwriting it.
func (d *Doc) MergeObject(key string, entries map[string]any) error {
	obj := map[string]json.RawMessage{}
	if existing, ok := d.raw[key]; ok {
		if err := json.Unmarshal(existing, &obj); err != nil {
			return fmt.Errorf("key %q exists but is not a JSON object: %w", key, err)
		}
	}
	for k, v := range entries {
		b, err := json.Marshal(v)
		if err != nil {
			return fmt.Errorf("marshal entry %q.%q: %w", key, k, err)
		}
		obj[k] = b
	}
	merged, err := json.Marshal(obj)
	if err != nil {
		return fmt.Errorf("marshal merged object %q: %w", key, err)
	}
	d.raw[key] = merged
	return nil
}

// DeleteObjectKey removes subKey from the JSON object at key. Returns whether
// subKey was present. A missing key is a no-op (removed=false, no error).
func (d *Doc) DeleteObjectKey(key, subKey string) (bool, error) {
	existing, ok := d.raw[key]
	if !ok {
		return false, nil
	}
	obj := map[string]json.RawMessage{}
	if err := json.Unmarshal(existing, &obj); err != nil {
		return false, fmt.Errorf("key %q exists but is not a JSON object: %w", key, err)
	}
	_, present := obj[subKey]
	delete(obj, subKey)
	merged, err := json.Marshal(obj)
	if err != nil {
		return false, fmt.Errorf("marshal object %q: %w", key, err)
	}
	d.raw[key] = merged
	return present, nil
}

// Save writes the document atomically: it backs up any existing file to
// <path>.bak, writes to a temp file in the same directory, then renames it over
// the target. Parent directories are created as needed.
func (d *Doc) Save() error {
	out, err := json.MarshalIndent(d.raw, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal settings: %w", err)
	}
	out = append(out, '\n')

	dir := filepath.Dir(d.path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("create %s: %w", dir, err)
	}

	// Back up an existing file before we touch it.
	if b, err := os.ReadFile(d.path); err == nil {
		if err := os.WriteFile(d.path+".bak", b, 0o600); err != nil {
			return fmt.Errorf("write backup: %w", err)
		}
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("read for backup: %w", err)
	}

	tmp, err := os.CreateTemp(dir, ".settings-*.json.tmp")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	tmpName := tmp.Name()
	// Best-effort cleanup if we bail before the rename.
	defer os.Remove(tmpName)

	if _, err := tmp.Write(out); err != nil {
		tmp.Close()
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return fmt.Errorf("sync temp file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close temp file: %w", err)
	}
	if err := os.Chmod(tmpName, 0o600); err != nil {
		return fmt.Errorf("chmod temp file: %w", err)
	}
	if err := os.Rename(tmpName, d.path); err != nil {
		return fmt.Errorf("rename into place: %w", err)
	}
	return nil
}
