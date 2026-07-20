// Package plugin registers and enables the orc Claude Code plugin by editing
// ~/.claude/settings.json. It writes the same extraKnownMarketplaces +
// enabledPlugins blocks the README documents, using the HTTPS clone URL form so
// installs work on machines without GitHub SSH keys (and side-steps the
// url.insteadOf rewrite gotcha).
package plugin

import (
	"github.com/HigorAlves/orc/cli/internal/settings"
)

const (
	// MarketplaceName is the key under extraKnownMarketplaces.
	MarketplaceName = "orc"
	// PluginID is the plugin@marketplace id under enabledPlugins.
	PluginID = "orc@orc"
	// RepoURL is the explicit HTTPS clone URL (see package doc for why).
	RepoURL = "https://github.com/HigorAlves/orc.git"
	// RepoSlug is the owner/repo form accepted by `claude plugin marketplace add`.
	RepoSlug = "HigorAlves/orc"

	keyMarketplaces = "extraKnownMarketplaces"
	keyPlugins      = "enabledPlugins"
)

// InstallOptions tunes an install.
type InstallOptions struct {
	// Ref pins a git tag or commit. Empty installs the latest (unpinned).
	Ref string
}

type marketplaceSource struct {
	Source string `json:"source"`
	URL    string `json:"url"`
	Ref    string `json:"ref,omitempty"`
}

type marketplaceEntry struct {
	Source marketplaceSource `json:"source"`
}

// Install writes (or rewrites) the orc marketplace + enable entries into doc.
// It preserves every other marketplace and plugin. Callers must Save the doc.
func Install(doc *settings.Doc, opts InstallOptions) error {
	entry := marketplaceEntry{
		Source: marketplaceSource{Source: "url", URL: RepoURL, Ref: opts.Ref},
	}
	if err := doc.MergeObject(keyMarketplaces, map[string]any{MarketplaceName: entry}); err != nil {
		return err
	}
	return doc.MergeObject(keyPlugins, map[string]any{PluginID: true})
}

// Uninstall removes the orc marketplace + enable entries, preserving siblings.
// Returns whether anything was actually removed.
func Uninstall(doc *settings.Doc) (bool, error) {
	removedMkt, err := doc.DeleteObjectKey(keyMarketplaces, MarketplaceName)
	if err != nil {
		return false, err
	}
	removedPlugin, err := doc.DeleteObjectKey(keyPlugins, PluginID)
	if err != nil {
		return false, err
	}
	return removedMkt || removedPlugin, nil
}

// State describes the current install state derived from settings.
type State struct {
	MarketplaceRegistered bool
	Enabled               bool
	Ref                   string
}

// Status reports the orc install state from doc.
func Status(doc *settings.Doc) (State, error) {
	var st State

	var mkt map[string]marketplaceEntry
	if ok, err := doc.Unmarshal(keyMarketplaces, &mkt); err != nil {
		return st, err
	} else if ok {
		if entry, present := mkt[MarketplaceName]; present {
			st.MarketplaceRegistered = true
			st.Ref = entry.Source.Ref
		}
	}

	var plugins map[string]bool
	if ok, err := doc.Unmarshal(keyPlugins, &plugins); err != nil {
		return st, err
	} else if ok {
		st.Enabled = plugins[PluginID]
	}

	return st, nil
}
