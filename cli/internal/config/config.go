// Package config edits orc's tunables by writing ORC_* variables into the
// settings.json "env" block (a documented Claude Code setting that injects env
// vars into every session). The orc plugin honors these env vars, so this is a
// known-correct persistence surface — no dependence on Claude Code's internal
// userConfig storage.
package config

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/HigorAlves/orc/cli/internal/settings"
)

const envKey = "env"

// Kind is the value type of a config option.
type Kind int

const (
	KindBool Kind = iota
	KindInt
	KindString
)

// Option is one tunable exposed by `orc config`.
type Option struct {
	Key  string // friendly name, e.g. "pr_size_budget"
	Env  string // backing ORC_* env var
	Kind Kind
	Desc string
}

// Options is the full set of tunables. Keep in sync with the plugin's docs.
var Options = []Option{
	{Key: "pr_size_budget", Env: "ORC_PR_LOC_BUDGET", Kind: KindInt,
		Desc: "Soft LOC budget for a PR (default 300)."},
	{Key: "protected_branches", Env: "ORC_PROTECTED_BRANCHES", Kind: KindString,
		Desc: "Comma-separated branches that require confirmation to commit/push."},
	{Key: "skip_tool_check", Env: "ORC_SKIP_TOOL_CHECK", Kind: KindBool,
		Desc: "Suppress the SessionStart tool dependency check."},
	{Key: "allow_ai_attribution", Env: "ORC_ALLOW_AI_ATTRIBUTION", Kind: KindBool,
		Desc: "Allow AI-attribution trailers in commits/PRs (off by default)."},
	{Key: "jira_pr_keyword", Env: "ORC_JIRA_PR_KEYWORD", Kind: KindString,
		Desc: "Keyword used to link a Jira ticket from a PR body."},
}

// Lookup finds an option by its friendly key.
func Lookup(key string) (Option, bool) {
	for _, o := range Options {
		if o.Key == key {
			return o, true
		}
	}
	return Option{}, false
}

// Set validates value for the option and writes it into the env block. A bool
// set to false removes the env var (restoring default behavior). Callers must
// Save the doc.
func Set(doc *settings.Doc, key, value string) error {
	opt, ok := Lookup(key)
	if !ok {
		return fmt.Errorf("unknown config key %q (see `orc config` for the list)", key)
	}

	switch opt.Kind {
	case KindInt:
		n, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil {
			return fmt.Errorf("%s must be an integer: %q", key, value)
		}
		if n <= 0 {
			return fmt.Errorf("%s must be a positive integer", key)
		}
		return writeEnv(doc, opt.Env, strconv.Itoa(n))
	case KindString:
		v := strings.TrimSpace(value)
		if v == "" {
			return fmt.Errorf("%s cannot be empty (use `orc config unset %s` to clear)", key, key)
		}
		return writeEnv(doc, opt.Env, v)
	case KindBool:
		b, err := parseBool(value)
		if err != nil {
			return fmt.Errorf("%s must be true or false: %q", key, value)
		}
		if b {
			return writeEnv(doc, opt.Env, "1")
		}
		_, err = doc.DeleteObjectKey(envKey, opt.Env)
		return err
	default:
		return fmt.Errorf("unhandled kind for %q", key)
	}
}

// Unset removes an option's env var. Returns whether it was present.
func Unset(doc *settings.Doc, key string) (bool, error) {
	opt, ok := Lookup(key)
	if !ok {
		return false, fmt.Errorf("unknown config key %q", key)
	}
	return doc.DeleteObjectKey(envKey, opt.Env)
}

// Get returns the currently-set options keyed by their friendly name (raw env
// value). Options with no env var set are omitted.
func Get(doc *settings.Doc) (map[string]string, error) {
	var env map[string]string
	if _, err := doc.Unmarshal(envKey, &env); err != nil {
		return nil, err
	}
	out := map[string]string{}
	for _, o := range Options {
		if v, ok := env[o.Env]; ok {
			out[o.Key] = v
		}
	}
	return out, nil
}

func writeEnv(doc *settings.Doc, name, value string) error {
	return doc.MergeObject(envKey, map[string]any{name: value})
}

func parseBool(s string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "1", "true", "yes", "on":
		return true, nil
	case "0", "false", "no", "off":
		return false, nil
	default:
		return false, fmt.Errorf("not a boolean")
	}
}
